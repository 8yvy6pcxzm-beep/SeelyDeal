import { createServiceClient } from "@/lib/supabase/server";
import { getAuthedUser } from "@/lib/supabase/auth-user";
import appConfig, { aiOveragePack } from "@/app.config";
import { safeFetchWebsiteText } from "@/lib/safe-fetch-website";
import {
  loadCoreContext,
  quotaExceeded,
  resolveTemplate,
  loadClientPrefill,
  loadUserDefaults,
} from "./context";
import { classifyIntent, type ChatMessage } from "./orchestrator";
import { plan } from "./planner";
import { buildWriterPrompt, CHIP_SETS } from "./prompts";
import { streamDraft } from "./writer";
import { sseResponse, type DraftEvent } from "./stream";

// AI drafting (company context + template docs + an optional attachment) routinely
// runs past the platform's default serverless timeout; give it real headroom so the
// request errors cleanly instead of hanging until the client times out on its own.
export const maxDuration = 120;

type Attachment = { name: string; mediaType: string; base64: string };

/** v2 route — a thin orchestrator wiring together the four layers described
 *  in AI-ARCHITECTURE-V2.md: Orchestrator (intent) → Planner (sections) →
 *  Clarifier (chips, no model call) → Writer (streamed generation). Auth,
 *  quota enforcement, and the response transport (SSE) live here; everything
 *  else is delegated to its own module. Compare to v1, where all of this
 *  plus a ~9000-token prompt and regex parsing lived in one 869-line file. */
export async function POST(req: Request) {
  const body = (await req.json()) as {
    messages: ChatMessage[];
    websiteUrl?: string;
    attachments?: Attachment[];
    currentDraft?: unknown;
    templateId?: string;
  };
  const { messages, websiteUrl, attachments, currentDraft, templateId } = body;

  const user = await getAuthedUser(req);
  if (!user) {
    return Response.json({ error: "Bu özellik için giriş yapmalısın." }, { status: 401 });
  }

  const MAX_TOTAL_ATTACHMENT_BYTES = 20 * 1024 * 1024;
  const totalAttachmentBytes = (attachments ?? []).reduce((sum, a) => sum + a.base64.length * 0.75, 0);
  if (totalAttachmentBytes > MAX_TOTAL_ATTACHMENT_BYTES) {
    return Response.json({ error: "Dosyaların toplamı çok büyük — birini kaldırıp tekrar dene." }, { status: 413 });
  }

  const service = createServiceClient();
  const { data: profile } = await service.from("profiles").select("company_id").eq("id", user.id).maybeSingle();
  if (!profile) {
    return Response.json({ error: "Şirket profilin bulunamadı." }, { status: 404 });
  }
  const companyId = profile.company_id as string;

  const core = await loadCoreContext(service, companyId);
  const over = quotaExceeded(core);
  if (over.drafts) {
    const overagePack = aiOveragePack[(core.company?.plan as "lite" | "pro" | "custom") ?? "lite"];
    return Response.json(
      {
        error: `Bu ayki AI teklif hakkın (${core.usage.limit}) doldu.`,
        overageLink: core.company?.overage_link ?? null,
        overagePrice: overagePack.price,
        overageDrafts: overagePack.extraDrafts,
      },
      { status: 429 },
    );
  }
  if (over.messages) {
    return Response.json({ error: "Bu ay çok fazla AI mesajı gönderildi. Lütfen bizimle iletişime geç." }, { status: 429 });
  }

  const fullChatText = messages.map((m) => m.content).join("\n").toLowerCase();
  const intent = classifyIntent(messages, currentDraft);

  // needs_info → Clarifier only. No model call at all (see
  // AI-ARCHITECTURE-V2.md §5) — the whole point of catching this in the
  // Orchestrator is to never spend a Writer turn on a question we already
  // know we need to ask.
  if (intent.kind === "needs_info") {
    const set = CHIP_SETS[intent.missing[0] === "sections" ? "missingSections" : "missingService"];
    return sseResponse(async function* () {
      yield { type: "clarify", question: set.question, chips: [...set.chips], multiSelect: "multiSelect" in set ? set.multiSelect : undefined } as DraftEvent;
      yield { type: "done", remaining: core.usage.limit - core.usage.count };
    });
  }

  const resolvedTemplate = await resolveTemplate({ service, core, currentDraft, templateId, chatText: fullChatText });
  const sectionPlan = plan(intent, core, resolvedTemplate, { messageCount: messages.length, chatText: fullChatText });

  if (sectionPlan.needsUserChoice) {
    const set = CHIP_SETS.missingSections;
    return sseResponse(async function* () {
      yield { type: "clarify", question: set.question, chips: [...set.chips], multiSelect: set.multiSelect } as DraftEvent;
      yield { type: "done", remaining: core.usage.limit - core.usage.count };
    });
  }

  const lastUserMessage = [...messages].reverse().find((m) => m.role === "user");
  const URL_PATTERN = /\b(?:https?:\/\/)?(?:www\.)?[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+\.[a-z]{2,}(?:\/[^\s)]*)?\b/i;
  const mentionedUrl = !websiteUrl ? lastUserMessage?.content.match(URL_PATTERN)?.[0] : undefined;
  const effectiveWebsiteUrl = websiteUrl || (mentionedUrl ? (/^https?:\/\//i.test(mentionedUrl) ? mentionedUrl : `https://${mentionedUrl}`) : undefined);

  let websiteContext = "";
  if (effectiveWebsiteUrl) {
    const text = await safeFetchWebsiteText(effectiveWebsiteUrl);
    websiteContext = text
      ? `\n\nPaylaşılan web sitesinden (${effectiveWebsiteUrl}) çıkarılan metin:\n"""${text}"""\nBu metni marka dili/tonu ve mümkünse karşı tarafın (müşterinin) unvan/adresini çıkarmak için kullan — metinde net geçmiyorsa UYDURMA.`
      : `\n\nNot: verilen web sitesi (${effectiveWebsiteUrl}) çekilemedi — kullanıcıya bilgiyi manuel anlatmasını iste.`;
  }

  const isCustom = (core.company?.plan ?? "lite") === "custom";
  let prefillBlock = "";
  if (isCustom) {
    const prefill = await loadClientPrefill(service, companyId, fullChatText);
    if (prefill) {
      prefillBlock = `\n\nGERİ DÖNEN MÜŞTERİ (AI Prefill): "${prefill.clientName}" için önceki bir teklif kaydı bulundu:\n${JSON.stringify(prefill.proposal)}\nBu müşteri için yeni teklif hazırlıyorsan, kullanıcı aksini belirtmedikçe bu önceki bilgileri varsayılan olarak kullan — tekrar sorma.`;
    }
  }

  const { userDefault, recentOwnProposals } = await loadUserDefaults(service, companyId, user.id);

  const companyBlock = `${core.company?.name ?? ""}${core.company?.address ? ` · ${core.company.address}` : ""}${core.company?.phone ? ` · ${core.company.phone}` : ""}${core.company?.email ? ` · ${core.company.email}` : ""} · ${appConfig.domain}`;
  const teamBlock = core.team.map((m) => `${m.name}${m.title ? ` (${m.title})` : ""}`).join(", ");

  const systemPrompt = buildWriterPrompt({
    core,
    resolvedTemplate,
    plan: sectionPlan,
    currentDraft,
    userInstructions: core.company?.ai_instructions?.trim() ?? "",
    companyBlock,
    teamBlock,
    userDefault,
    recentOwnProposals,
    websiteContext,
    prefillBlock,
  });

  const themeJson = resolvedTemplate?.theme
    ? resolvedTemplate.theme
    : core.company?.font && core.company.font !== "default"
      ? { font: core.company.font }
      : undefined;

  return sseResponse(async function* (signal) {
    let produced = false;
    try {
      for await (const event of streamDraft({
        systemPrompt,
        messages,
        attachments,
        service,
        companyId,
        plan: core.company?.plan ?? "lite",
        resolvedTemplateBlocks: resolvedTemplate?.blocks,
        themeJson,
        signal,
      })) {
        if (event.type === "draft") produced = true;
        yield event;
      }
    } finally {
      // Message count always increments (every call is a real API charge);
      // the draft quota only counts a turn that actually produced a draft —
      // same split as v1 (route.ts:836-841).
      const month = new Date().toISOString().slice(0, 7);
      await service.from("ai_usage").upsert(
        {
          company_id: companyId,
          month,
          count: produced ? core.usage.count + 1 : core.usage.count,
          message_count: core.usage.messageCount + 1,
        },
        { onConflict: "company_id,month" },
      );
    }
    yield { type: "done", remaining: core.usage.limit - (produced ? core.usage.count + 1 : core.usage.count) };
  });
}
