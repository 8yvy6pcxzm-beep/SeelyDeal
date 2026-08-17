import type { createServiceClient as CreateServiceClient } from "@/lib/supabase/server";
import { templates } from "@/lib/demo/data";
import { planAllows } from "@/lib/plan";
import type { ProposalBlock } from "@/lib/types/proposal-blocks";

/** Lazy / tiered context loading (see AI-ARCHITECTURE-V2.md §3). Three tiers:
 *   - CORE:  always loaded, cheap, small — company/team/default_sections/usage.
 *   - INDEX: a summary of what EXISTS (doc titles/types, template names) —
 *            small enough to always include, but never the full `content`.
 *   - DEEP:  a single document's/template's full content, or a specific
 *            client's proposal history — only fetched on demand, by name/id
 *            resolution or a tool call (see tools.ts search_content_library).
 * This replaces v1 route.ts:325-346, where all of these were fetched and
 * fully inlined into the system prompt on every single turn. */

type Service = ReturnType<typeof CreateServiceClient>;

export type CompanyRow = {
  id: string;
  name: string | null;
  plan: "lite" | "pro" | "custom" | null;
  ai_monthly_limit: number | null;
  ai_instructions: string | null;
  default_sections: Record<string, boolean> | null;
  logo_url: string | null;
  primary_color: string | null;
  font: string | null;
  tagline: string | null;
  email: string | null;
  address: string | null;
  phone: string | null;
  overage_link: string | null;
};

export type TeamMemberRow = { name: string; title: string | null };

export type DocIndexRow = { id: string; type: string; title: string; is_default_template: boolean };

export type CoreContext = {
  companyId: string;
  company: CompanyRow | null;
  team: TeamMemberRow[];
  usage: { count: number; messageCount: number; limit: number; messageLimit: number };
  docsIndex: DocIndexRow[];
  hasServiceDoc: boolean;
  hasOwnLibraryDocs: boolean;
  savedTemplateNames: string[];
};

/** Tier 1 — CORE. Cheap enough (a handful of small rows) to fetch on every
 *  single request; nothing here has a `content`/free-text field over a few
 *  hundred bytes. */
export async function loadCoreContext(service: Service, companyId: string): Promise<CoreContext> {
  const month = new Date().toISOString().slice(0, 7);

  const [{ data: company }, { data: team }, { data: docsIndex }, { data: usageRow }, { data: templateRows }] = await Promise.all([
    service.from("companies").select("*").eq("id", companyId).single(),
    service.from("team_members").select("name, title").eq("company_id", companyId),
    // Index only — id/type/title/is_default_template, never `content`. The
    // full text of a doc is fetched only via search_content_library (tools.ts)
    // once the Writer actually decides it needs one.
    service.from("company_documents").select("id, type, title, is_default_template").eq("company_id", companyId),
    service.from("ai_usage").select("count, message_count").eq("company_id", companyId).eq("month", month).maybeSingle(),
    service.from("templates").select("name").eq("company_id", companyId),
  ]);

  const limit: number = company?.ai_monthly_limit ?? 10;
  const messageMultiplier = (company?.plan ?? "lite") === "lite" ? 15 : 18;

  const rows = (docsIndex ?? []) as DocIndexRow[];

  return {
    companyId,
    company: (company as CompanyRow) ?? null,
    team: (team ?? []) as TeamMemberRow[],
    usage: {
      count: usageRow?.count ?? 0,
      messageCount: usageRow?.message_count ?? 0,
      limit,
      messageLimit: limit * messageMultiplier,
    },
    docsIndex: rows,
    hasServiceDoc: rows.some((d) => d.type === "service_description"),
    hasOwnLibraryDocs: rows.some((d) => d.type !== "content_block"),
    savedTemplateNames: ((templateRows ?? []) as { name: string }[]).map((t) => t.name).filter(Boolean),
  };
}

export function quotaExceeded(core: CoreContext): { drafts: boolean; messages: boolean } {
  return {
    drafts: core.usage.count >= core.usage.limit,
    messages: core.usage.messageCount >= core.usage.messageLimit,
  };
}

/** Tier 2/3 — resolved template (DEEP). Only fetched when the request is
 *  actually starting a new draft from a template (explicit templateId, or a
 *  nickname/saved-name match in the chat text) — mirrors v1
 *  resolveTemplateById/matchNamedTemplate/matchCompanyTemplateByName
 *  (route.ts:52-128) unchanged, just relocated. */
export type ResolvedTemplate = {
  name: string;
  introText?: string;
  aboutText?: string;
  sections: { title: string; body: string }[];
  lineItems: { name: string; qty: number; unit: number }[];
  contractText?: string;
  theme?: { primaryColor: string; accentColor: string; font?: string };
  nickname?: string;
  source: "demo" | "company";
  /** true only for a demo template with kind: "draft" (a real, usable example —
   *  see getDraftTemplates in lib/demo/data.ts). Company templates are always
   *  real content too; this just distinguishes demo "visual skeleton" (t1–t4,
   *  kind unset) from demo "draft example" among source:"demo" rows. */
  isDraftExample: boolean;
  blocks?: ProposalBlock[];
};

type CompanyTemplateRow = {
  id: string;
  name: string;
  sections: unknown;
  line_items: unknown;
  blocks: unknown;
  contract_text: string | null;
  intro_text: string | null;
  about_text: string | null;
};

function normalizeDemoTemplate(t: (typeof templates)[number]): ResolvedTemplate {
  return {
    name: t.name.tr,
    introText: t.introText?.tr,
    aboutText: t.aboutText?.tr,
    sections: t.sections.map((s) => ({ title: s.title.tr, body: s.body.tr })),
    lineItems: (t.lineItems ?? []).map((li) => ({ name: li.name.tr, qty: li.qty, unit: li.unit })),
    contractText: t.contractText?.tr,
    theme: t.theme,
    nickname: t.nickname,
    source: "demo",
    isDraftExample: t.kind === "draft",
  };
}

function normalizeCompanyTemplate(row: CompanyTemplateRow): ResolvedTemplate {
  return {
    name: row.name,
    introText: row.intro_text ?? undefined,
    aboutText: row.about_text ?? undefined,
    sections: (row.sections ?? []) as { title: string; body: string }[],
    lineItems: (row.line_items ?? []) as { name: string; qty: number; unit: number }[],
    contractText: row.contract_text ?? undefined,
    blocks: Array.isArray(row.blocks) && row.blocks.length > 0 ? (row.blocks as ProposalBlock[]) : undefined,
    source: "company",
    isDraftExample: false,
  };
}

/** Nicknames are opt-in per demo template. When the same nickname exists in
 *  more than one sector, prefer the one whose sector name also appears in the
 *  chat, falling back to "Genel". */
export function matchNamedTemplate(chatText: string): ResolvedTemplate | undefined {
  const hits = templates.filter((t) => t.nickname && new RegExp(`\\b${t.nickname}\\b`, "i").test(chatText));
  const picked =
    hits.length <= 1
      ? hits[0]
      : hits.find((t) => chatText.includes(t.category.tr.toLowerCase())) ??
        hits.find((t) => t.category.tr === "Genel") ??
        hits[0];
  return picked ? normalizeDemoTemplate(picked) : undefined;
}

/** Unlike demo templates, a company's own saved templates don't have curated
 *  nicknames, so this matches on the literal saved name mentioned in chat. */
export async function matchCompanyTemplateByName(
  chatText: string,
  service: Service,
  companyId: string,
): Promise<ResolvedTemplate | undefined> {
  const { data } = await service
    .from("templates")
    .select("id, name, sections, line_items, blocks, contract_text, intro_text, about_text")
    .eq("company_id", companyId);
  const rows = (data ?? []) as CompanyTemplateRow[];
  const hit = rows.find((t) => t.name && chatText.includes(t.name.toLowerCase()));
  return hit ? normalizeCompanyTemplate(hit) : undefined;
}

/** Resolves a template by id from either the built-in demo set or the
 *  company's own saved (DB) templates — "Bu şablonla yaz" sends a bare id. */
export async function resolveTemplateById(
  id: string,
  companyId: string,
  service: Service,
): Promise<ResolvedTemplate | undefined> {
  const demo = templates.find((t) => t.id === id);
  if (demo) return normalizeDemoTemplate(demo);

  const { data: row } = await service
    .from("templates")
    .select("name, sections, line_items, blocks, contract_text, intro_text, about_text")
    .eq("id", id)
    .eq("company_id", companyId)
    .maybeSingle();
  if (!row) return undefined;

  return normalizeCompanyTemplate({ id, ...row });
}

/** Resolves the template (if any) that this new draft should start from —
 *  skipped entirely on Lite (templates are Pro+, see planAllows) and once a
 *  real draft already exists (edits go through revise, not re-resolution). */
export async function resolveTemplate(opts: {
  service: Service;
  core: CoreContext;
  currentDraft: unknown;
  templateId?: string;
  chatText: string;
}): Promise<ResolvedTemplate | undefined> {
  if (!planAllows(opts.core.company?.plan, "templates_create")) return undefined;
  if (opts.currentDraft) return undefined;
  if (opts.templateId) return resolveTemplateById(opts.templateId, opts.core.companyId, opts.service);
  return (
    matchNamedTemplate(opts.chatText) ??
    (await matchCompanyTemplateByName(opts.chatText, opts.service, opts.core.companyId))
  );
}

/** Tier 3 — DEEP. A returning client's most recent proposal (AI Prefill,
 *  Custom plan only) — only queried when their name is actually mentioned in
 *  chat, never preloaded. Mirrors v1 route.ts:426-446. */
export async function loadClientPrefill(
  service: Service,
  companyId: string,
  chatText: string,
): Promise<{ clientName: string; proposal: Record<string, unknown> } | undefined> {
  const { data: clients } = await service.from("clients").select("id, name").eq("company_id", companyId);
  const matched = (clients ?? []).find((c: { id: string; name: string }) => c.name && chatText.includes(c.name.toLowerCase()));
  if (!matched) return undefined;

  const { data: lastProposal } = await service
    .from("proposals")
    .select("title, value, line_items, sections, client_contact, contract_text, billing_options")
    .eq("client_id", matched.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return lastProposal ? { clientName: matched.name, proposal: lastProposal } : undefined;
}

/** Tier 3 — DEEP. The signed-in user's personal default (template+format) and
 *  their last 2 proposals — small rows, but scoped to `created_by = user.id`
 *  so they're only meaningful once we know who's asking; kept out of CORE
 *  since a brand-new draft ("needs_info") never gets this far. */
export async function loadUserDefaults(service: Service, companyId: string, userId: string) {
  const [{ data: userDefault }, { data: recentOwnProposals }] = await Promise.all([
    service.from("user_defaults").select("*").eq("profile_id", userId).maybeSingle(),
    service
      .from("proposals")
      .select("template_id, format")
      .eq("company_id", companyId)
      .eq("created_by", userId)
      .order("created_at", { ascending: false })
      .limit(2),
  ]);
  return {
    userDefault: userDefault as Record<string, unknown> | null,
    recentOwnProposals: (recentOwnProposals ?? []) as { template_id: string | null; format: string | null }[],
  };
}
