"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { Sparkles, X, Send, Loader2, Check, Link2, CreditCard, Paperclip, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLang } from "@/components/i18n/language-provider";
import { cn } from "@/lib/utils";

type Msg = { role: "user" | "assistant"; content: string; attachmentNames?: string[]; hidden?: boolean };
type Attachment = { name: string; mediaType: string; base64: string };
type BillingOption = { key: string; label: { tr: string; en: string }; price: number; paymentLink?: string };
type ClientContact = { company?: string; contactName?: string; title?: string; address?: string; phone?: string; email?: string; website?: string };
type Draft = {
  title: string;
  client: string;
  value: number;
  introText?: string;
  aboutText?: string;
  clientContact?: ClientContact;
  sections: { title: string; body: string }[];
  lineItems: { name: string; qty: number; unit: number; optional?: boolean; included?: boolean }[];
  billingOptions?: BillingOption[];
  nextSteps?: { title: string; body: string }[];
  validDays?: number;
  contractText?: string;
  confirmed?: boolean;
  /** Per-template visual theme (e.g. from the construction template) — passed through untouched. */
  themeJson?: { primaryColor: string; accentColor: string; font?: string };
};

/** Renders "**bold**" markdown segments as real <strong> text, and splits numbered/bulleted
 * list items onto their own line even when the model runs them together in one paragraph. */
function renderFormatted(text: string) {
  let withBreaks = text
    .replace(/([^\n])(\s)(\d+\.\s)/g, "$1\n$3")
    .replace(/([^\n])(\s)([-•]\s)/g, "$1\n$3");

  // If the last list item is followed by a closing remark in the same line
  // ("...? Bunları paylaşırsan hemen hazırlayayım."), break before that
  // trailing sentence too, so it reads as its own paragraph.
  const lines = withBreaks.split("\n");
  const lastIsListItem = /^\s*(\d+\.|[-•])\s/.test(lines[lines.length - 1] ?? "");
  if (lastIsListItem) {
    const last = lines[lines.length - 1];
    const boundary = /[.!?]\s+(?=[A-ZÇĞİÖŞÜ])/g;
    let match: RegExpExecArray | null;
    let lastMatchEnd = -1;
    while ((match = boundary.exec(last))) lastMatchEnd = match.index + match[0].length;
    if (lastMatchEnd > 0) {
      lines[lines.length - 1] = last.slice(0, lastMatchEnd).trimEnd();
      lines.push(last.slice(lastMatchEnd));
    }
  }
  withBreaks = lines.join("\n");

  return withBreaks.split("\n").map((line, i) => {
    const markerMatch = line.match(/^(\s*(?:\d+\.|[-•])\s)/);
    const marker = markerMatch?.[1];
    const rest = marker ? line.slice(marker.length) : line;
    const parts = rest.split(/(\*\*[^*]+\*\*)/g);
    return (
      <p key={i} className={i > 0 ? "mt-1.5" : undefined}>
        {marker && <strong className="font-semibold">{marker}</strong>}
        {parts.map((part, j) =>
          part.startsWith("**") && part.endsWith("**") ? (
            <strong key={j} className="font-semibold">{part.slice(2, -2)}</strong>
          ) : (
            <span key={j}>{part}</span>
          ),
        )}
      </p>
    );
  });
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Splits an onboarding reply into bubbles of ~2 sentences/list items each, for
 * the sequential "typing" reveal — list lines (already one sentence each, per
 * the prompt's rule) stay whole, plain prose lines get split at sentence ends,
 * then consecutive parts are paired up so it reads as a chat, not a wall of
 * one-liners. */
function splitIntoSentenceBubbles(text: string): string[] {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const rawParts: string[] = [];
  for (const line of lines) {
    if (/^(\d+\.|[-•])\s/.test(line)) {
      rawParts.push(line);
    } else {
      const sentences = line.match(/[^.!?]+[.!?]*(?:\s+|$)/g) ?? [line];
      for (const s of sentences) {
        const trimmed = s.trim();
        if (trimmed) rawParts.push(trimmed);
      }
    }
  }

  const isListLine = (s: string) => /^(\d+\.|[-•])\s/.test(s);
  const bubbles: string[] = [];
  for (let i = 0; i < rawParts.length; i += 2) {
    const a = rawParts[i];
    const b = rawParts[i + 1];
    if (!b) {
      bubbles.push(a);
    } else {
      bubbles.push(isListLine(a) || isListLine(b) ? `${a}\n${b}` : `${a} ${b}`);
    }
  }
  return bubbles;
}

export function AiDraftDialog({
  open,
  onClose,
  onSaved,
  mode = "proposal",
  initialTemplateId,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  /** "template" builds/saves a reusable template (POST /api/templates) instead of a proposal. */
  mode?: "proposal" | "template";
  /** Set when drafting a new proposal from a template ("Bu şablonla yaz") — the AI resolves
   *  this id server-side and drafts real content from it instead of us dumping raw text. */
  initialTemplateId?: string;
}) {
  const { lang } = useLang();
  const [mounted, setMounted] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [showWebsiteField, setShowWebsiteField] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [paymentLink, setPaymentLink] = useState("");
  const [showPaymentField, setShowPaymentField] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [overage, setOverage] = useState<{ link: string | null; price: number; drafts: number } | null>(null);
  // Once set, "Teklife ekle" becomes "Değişiklikleri kaydet" and saves PATCH this
  // proposal instead of creating a new one — the dialog stays open and chattable
  // after the first save so the user can keep refining it, on every plan.
  const [savedProposalId, setSavedProposalId] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [attachError, setAttachError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  // Fetched fresh each time the dialog opens — whether this company still needs
  // Seely's first-chat intro (companies.onboarding_completed === false).
  const [onboardingPending, setOnboardingPending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const stoppedRef = useRef(false);
  const backdropMouseDownRef = useRef(false);

  const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
  // Per-file downscaling keeps images small, but PDFs pass through untouched —
  // several max-size files at once (e.g. onboarding: multiple sample proposals)
  // could still add up to a payload big enough to risk the function timing out.
  const MAX_TOTAL_ATTACHMENT_BYTES = 20 * 1024 * 1024;
  const MAX_ATTACHMENTS = 5;
  const ACCEPTED_TYPES = ["application/pdf", "image/png", "image/jpeg", "image/webp", "image/gif"];
  const EXT_TO_MEDIA_TYPE: Record<string, string> = {
    pdf: "application/pdf",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    webp: "image/webp",
    gif: "image/gif",
  };

  /** Some drag/paste sources (certain screenshot tools, some file managers) hand us
   * a File with an empty or generic `type` ("", "application/octet-stream") even
   * though the file itself is a perfectly normal PNG/JPG/PDF — fall back to the
   * extension so those aren't rejected as "unsupported". */
  function resolveMediaType(file: File): string | null {
    if (ACCEPTED_TYPES.includes(file.type)) return file.type;
    const ext = file.name.split(".").pop()?.toLowerCase();
    return (ext && EXT_TO_MEDIA_TYPE[ext]) || null;
  }

  const SECTION_OPTIONS: { key: string; tr: string; en: string }[] = [
    { key: "intro", tr: "Ön Yazı", en: "Cover letter" },
    { key: "about", tr: "Hakkımızda", en: "About us" },
    { key: "team", tr: "Ekibimiz", en: "Our team" },
    { key: "scope", tr: "Hizmet Kapsamı", en: "Scope of work" },
    { key: "process", tr: "Süreç / Nasıl Çalışıyoruz", en: "Process / how we work" },
    { key: "pricing", tr: "Paket ve Ücret", en: "Package & pricing" },
    { key: "terms", tr: "Sözleşme Şartları", en: "Contract terms" },
    { key: "next", tr: "Sonraki Adımlar", en: "Next steps" },
  ];
  const [showChecklist, setShowChecklist] = useState(false);
  const [checkedSections, setCheckedSections] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(SECTION_OPTIONS.map((s) => [s.key, true])),
  );

  function sendWithChecklist() {
    const included = SECTION_OPTIONS.filter((s) => checkedSections[s.key]).map((s) => (lang === "tr" ? s.tr : s.en));
    const excluded = SECTION_OPTIONS.filter((s) => !checkedSections[s.key]).map((s) => (lang === "tr" ? s.tr : s.en));
    const summary =
      lang === "tr"
        ? `Kapsamlı bir teklif hazırla. Dahil edilecek bölümler: ${included.join(", ")}.${excluded.length ? ` Şunları dahil ETME: ${excluded.join(", ")}.` : ""}${input.trim() ? ` ${input.trim()}` : ""}`
        : `Draft a comprehensive proposal. Include these sections: ${included.join(", ")}.${excluded.length ? ` Do NOT include: ${excluded.join(", ")}.` : ""}${input.trim() ? ` ${input.trim()}` : ""}`;
    setShowChecklist(false);
    send(summary);
  }

  const MAX_IMAGE_DIMENSION = 1600;
  const RECOMPRESS_THRESHOLD_BYTES = 1.5 * 1024 * 1024;

  /** Big screenshots (multi-MB PNGs) inflate the request payload and how long
   * Claude takes to look at them — often enough, combined with a live site
   * fetch on the same turn, to run past the function's time limit and drop the
   * connection. Downscaling to a sane max dimension + re-encoding as JPEG
   * keeps the image perfectly readable while cutting that risk way down. */
  function downscaleImage(file: File): Promise<{ mediaType: string; base64: string }> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const objectUrl = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(objectUrl);
        const scale = Math.min(1, MAX_IMAGE_DIMENSION / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("no canvas context"));
          return;
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.82);
        resolve({ mediaType: "image/jpeg", base64: dataUrl.split(",")[1] ?? "" });
      };
      img.onerror = () => reject(new Error("image decode failed"));
      img.src = objectUrl;
    });
  }

  function readAsBase64(file: File, mediaType: string): Promise<{ mediaType: string; base64: string }> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        resolve({ mediaType, base64: result.split(",")[1] ?? "" });
      };
      reader.onerror = () => reject(new Error("file read failed"));
      reader.readAsDataURL(file);
    });
  }

  async function processFile(file: File, currentCount: number, currentTotalBytes: number) {
    setAttachError(null);

    if (currentCount >= MAX_ATTACHMENTS) {
      setAttachError(
        lang === "tr" ? `En fazla ${MAX_ATTACHMENTS} dosya ekleyebilirsin.` : `You can attach up to ${MAX_ATTACHMENTS} files.`,
      );
      return;
    }
    const mediaType = resolveMediaType(file);
    if (!mediaType) {
      setAttachError(lang === "tr" ? "Sadece PDF veya resim (PNG/JPG) ekleyebilirsin." : "Only PDF or image files (PNG/JPG) are supported.");
      return;
    }
    if (file.size > MAX_ATTACHMENT_BYTES) {
      setAttachError(lang === "tr" ? "Dosya en fazla 10MB olabilir." : "File must be under 10MB.");
      return;
    }
    if (currentTotalBytes + file.size > MAX_TOTAL_ATTACHMENT_BYTES) {
      setAttachError(
        lang === "tr"
          ? "Dosyaların toplamı çok büyük — birini kaldırıp tekrar dene."
          : "Attachments add up to too much — remove one and try again.",
      );
      return;
    }

    const shouldDownscale = mediaType.startsWith("image/") && file.size > RECOMPRESS_THRESHOLD_BYTES;
    try {
      const { mediaType: finalType, base64 } = shouldDownscale
        ? await downscaleImage(file)
        : await readAsBase64(file, mediaType);
      setAttachments((prev) => [...prev, { name: file.name, mediaType: finalType, base64 }]);
    } catch {
      // Downscale failed for some reason (corrupt image, unsupported codec) —
      // fall back to the original file rather than silently dropping it.
      try {
        const { mediaType: finalType, base64 } = await readAsBase64(file, mediaType);
        setAttachments((prev) => [...prev, { name: file.name, mediaType: finalType, base64 }]);
      } catch {
        setAttachError(lang === "tr" ? "Dosya okunamadı." : "Couldn't read the file.");
      }
    }
  }

  function processFiles(files: FileList | File[]) {
    const startCount = attachments.length;
    let runningBytes = attachments.reduce((sum, a) => sum + a.base64.length * 0.75, 0);
    Array.from(files).forEach((file, i) => {
      processFile(file, startCount + i, runningBytes);
      runningBytes += file.size;
    });
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    e.target.value = "";
    if (!files || files.length === 0) return;
    processFiles(files);
  }

  function handleDragOver(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    if (e.dataTransfer.types.includes("Files")) setDragOver(true);
  }

  function handleDragLeave(e: React.DragEvent<HTMLDivElement>) {
    if (e.currentTarget === e.target) setDragOver(false);
  }

  // Belt-and-suspenders reset: if the drag is cancelled (dropped outside the
  // window, Esc during the OS-level drag) neither dragleave nor drop ever
  // fires on our container, so dragOver stays stuck true. "dragend" fires on
  // the whole page for every drag that started, regardless of how it ended.
  useEffect(() => {
    function onDragEnd() {
      setDragOver(false);
    }
    window.addEventListener("dragend", onDragEnd);
    window.addEventListener("drop", onDragEnd);
    return () => {
      window.removeEventListener("dragend", onDragEnd);
      window.removeEventListener("drop", onDragEnd);
    };
  }, []);

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files?.length) processFiles(e.dataTransfer.files);
  }

  function handlePaste(e: React.ClipboardEvent<HTMLTextAreaElement>) {
    const items = e.clipboardData?.items;
    if (!items) return;
    const files: File[] = [];
    for (const item of items) {
      if (item.kind === "file" && item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (file) files.push(file);
      }
    }
    if (files.length) {
      e.preventDefault();
      processFiles(files);
    }
  }

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, draft]);

  useEffect(() => {
    setMounted(true);
  }, []);

  // The dialog is kept mounted (rendering null while closed) instead of being
  // removed from the tree, so any drag state left over from a previous open
  // (e.g. a cancelled drag that never reset it) would otherwise still be
  // showing when it's opened again — force a clean slate every time.
  useEffect(() => {
    if (open) setDragOver(false);
  }, [open]);

  useEffect(() => {
    if (!open || !initialTemplateId || messages.length > 0) return;
    // Kick off the chat ourselves — the AI resolves the template server-side and
    // drafts real content from it (blended with the company's own doc library,
    // if any) instead of us dumping raw template text into the preview.
    send(lang === "tr" ? "Bu şablonu kullanmak istiyorum." : "I'd like to use this template.");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialTemplateId]);

  useEffect(() => {
    if (!open || initialTemplateId) return;
    fetch("/api/settings/onboarding")
      .then((r) => r.json())
      .then((d) => setOnboardingPending(d.onboardingCompleted === false))
      .catch(() => {});
  }, [open, initialTemplateId]);

  useEffect(() => {
    if (!open || !onboardingPending || initialTemplateId || messages.length > 0) return;
    // Kick off Seely's first-chat intro ourselves — no visible user bubble, the
    // company just sees the intro appear the moment the dialog opens.
    send(lang === "tr" ? "Merhaba" : "Hi", { hidden: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, onboardingPending]);

  /** Esc while Seely is replying stops the request and puts the last message back
   * in the input so the user can fix a typo/instruction and resend — mirrors how
   * Esc interrupts an in-progress agent turn here in Claude Code. */
  function stopGeneration() {
    if (!loading) return;
    stoppedRef.current = true;
    controllerRef.current?.abort();
    setMessages((m) => {
      const last = m[m.length - 1];
      if (last?.role === "user") {
        setInput(last.content);
        return m.slice(0, -1);
      }
      return m;
    });
  }

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && loading) {
        e.stopPropagation();
        stopGeneration();
      }
    }
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [open, loading]);

  if (!open || !mounted) return null;

  /** Matches a bare "save it" message ("kaydet", "teklife ekle", "save") — nothing else in the sentence, so it doesn't misfire on "kaydettim ama..." or similar. */
  function isSaveIntent(text: string) {
    return /^(kaydet(?:sene)?|kaydediver|teklife ekle|ekle|save( it| this)?)[.!?]*$/i.test(text.trim());
  }

  async function send(override?: string, opts?: { hidden?: boolean }) {
    if ((!override?.trim() && !input.trim() && attachments.length === 0) || loading) return;
    const text =
      override?.trim() ||
      input.trim() ||
      (lang === "tr" ? "Ektesindeki dokümanı incele ve teklif için kullan." : "Review the attached document and use it for the proposal.");

    // Draft's already complete and sitting in the preview — "kaydet"/"save" means
    // save it (or save the latest edits, if already saved once), not "chat about
    // saving." Skip the round-trip to the AI entirely.
    if (draft && !override && isSaveIntent(text)) {
      setMessages((m) => [...m, { role: "user", content: text }]);
      setInput("");
      saveDraft();
      return;
    }

    const next = [
      ...messages,
      { role: "user" as const, content: text, attachmentNames: attachments.map((a) => a.name), hidden: opts?.hidden },
    ];
    setMessages(next);
    setInput("");
    const sentAttachments = attachments;
    setAttachments([]);
    setLoading(true);
    setSending(true);
    setError(null);
    setOverage(null);

    const controller = new AbortController();
    controllerRef.current = controller;
    stoppedRef.current = false;
    const timeoutId = window.setTimeout(() => controller.abort(), 130_000);

    const requestBody = JSON.stringify({
      messages: next.map(({ role, content }) => ({ role, content })),
      websiteUrl: websiteUrl || undefined,
      attachments: sentAttachments.length ? sentAttachments : undefined,
      currentDraft: draft ?? undefined,
      templateId: !draft ? initialTemplateId : undefined,
    });

    // A dropped connection/transient network blip shouldn't dead-end the user
    // in an error box — silently retry once before actually surfacing it.
    async function fetchWithRetry(attempt = 1): Promise<Response> {
      try {
        return await fetch("/api/draft-proposal", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: requestBody,
          signal: controller.signal,
        });
      } catch (err) {
        if (attempt < 2 && !(err instanceof DOMException && err.name === "AbortError")) {
          await sleep(1200);
          return fetchWithRetry(attempt + 1);
        }
        throw err;
      }
    }

    try {
      const res = await fetchWithRetry();
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Bir şeyler ters gitti.");
        if (res.status === 429) {
          setOverage({ link: data.overageLink ?? null, price: data.overagePrice, drafts: data.overageDrafts });
        }
        return;
      }
      const reply = (data.reply ?? "").trim()
        ? data.reply
        : lang === "tr"
          ? "Teklifi güncelledim, aşağıdaki önizlemeden kontrol edebilirsin."
          : "Updated the proposal — check the preview below.";
      // Capture before the onboarding-completed branch below can flip it —
      // sequential reveal only applies to onboarding replies, never regular chat.
      const useSequentialReveal = onboardingPending;
      if (useSequentialReveal) {
        const bubbles = splitIntoSentenceBubbles(reply);
        for (let i = 0; i < bubbles.length; i++) {
          if (stoppedRef.current) break;
          setSending(true);
          await sleep(i === 0 ? 350 : 850);
          if (stoppedRef.current) break;
          setSending(false);
          setMessages((m) => [...m, { role: "assistant", content: bubbles[i] }]);
        }
      } else {
        setMessages((m) => [...m, { role: "assistant", content: reply }]);
      }
      if (data.draft) {
        // The server only stamps themeJson on the turn it resolves the template — carry
        // it forward on later turns instead of losing it.
        const nextDraft = { ...data.draft, themeJson: data.draft.themeJson ?? draft?.themeJson };
        setDraft(nextDraft);
        // The model only sets this after the user explicitly confirmed the final
        // proposal in chat — save it immediately instead of waiting for a manual click.
        if (data.draft.confirmed) saveDraft(nextDraft);
      }
      if (data.instruction) {
        fetch("/api/settings/ai-instructions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ instruction: data.instruction }),
        })
          .then(async (r) => {
            if (!r.ok) {
              const d = await r.json().catch(() => null);
              setError(d?.error || (lang === "tr" ? "Talimat kaydedilemedi." : "Couldn't save the instruction."));
            }
          })
          .catch(() => setError(lang === "tr" ? "Talimat kaydedilemedi." : "Couldn't save the instruction."));
      }
      if (data.brand) {
        // The reply text already claims what got saved — if either call actually
        // fails, surface it instead of silently leaving the user believing it worked.
        const logoAttachment = sentAttachments.find((a) => a.mediaType.startsWith("image/"));
        if (data.brand.setLogo && logoAttachment) {
          fetch("/api/settings/logo", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ mediaType: logoAttachment.mediaType, base64: logoAttachment.base64 }),
          })
            .then(async (r) => {
              if (!r.ok) {
                const d = await r.json().catch(() => null);
                setError(d?.error || (lang === "tr" ? "Logo kaydedilemedi." : "Couldn't save the logo."));
              }
            })
            .catch(() => setError(lang === "tr" ? "Logo kaydedilemedi." : "Couldn't save the logo."));
        }
        if (data.brand.primaryColor) {
          fetch("/api/settings/brand-color", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ primaryColor: data.brand.primaryColor }),
          })
            .then(async (r) => {
              if (!r.ok) {
                const d = await r.json().catch(() => null);
                setError(d?.error || (lang === "tr" ? "Marka rengi kaydedilemedi." : "Couldn't save the brand color."));
              }
            })
            .catch(() => setError(lang === "tr" ? "Marka rengi kaydedilemedi." : "Couldn't save the brand color."));
        }
        if (data.brand.name) {
          fetch("/api/settings/company-name", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: data.brand.name }),
          })
            .then(async (r) => {
              if (!r.ok) {
                const d = await r.json().catch(() => null);
                setError(d?.error || (lang === "tr" ? "Şirket adı kaydedilemedi." : "Couldn't save the company name."));
              }
            })
            .catch(() => setError(lang === "tr" ? "Şirket adı kaydedilemedi." : "Couldn't save the company name."));
        }
        if (data.brand.tagline) {
          fetch("/api/settings/tagline", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ tagline: data.brand.tagline }),
          })
            .then(async (r) => {
              if (!r.ok) {
                const d = await r.json().catch(() => null);
                setError(d?.error || (lang === "tr" ? "Slogan kaydedilemedi." : "Couldn't save the tagline."));
              }
            })
            .catch(() => setError(lang === "tr" ? "Slogan kaydedilemedi." : "Couldn't save the tagline."));
        }
        if (data.brand.email) {
          fetch("/api/settings/email", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: data.brand.email }),
          })
            .then(async (r) => {
              if (!r.ok) {
                const d = await r.json().catch(() => null);
                setError(d?.error || (lang === "tr" ? "E-posta kaydedilemedi." : "Couldn't save the email."));
              }
            })
            .catch(() => setError(lang === "tr" ? "E-posta kaydedilemedi." : "Couldn't save the email."));
        }
        if (data.brand.servicesSummary) {
          fetch("/api/settings/service-description", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ content: data.brand.servicesSummary }),
          })
            .then(async (r) => {
              if (!r.ok) {
                const d = await r.json().catch(() => null);
                setError(d?.error || (lang === "tr" ? "Hizmet/fiyatlandırma kaydedilemedi." : "Couldn't save the service/pricing summary."));
              }
            })
            .catch(() => setError(lang === "tr" ? "Hizmet/fiyatlandırma kaydedilemedi." : "Couldn't save the service/pricing summary."));
        }
      }
      if (data.onboarding?.completed) {
        setOnboardingPending(false);
        fetch("/api/settings/onboarding", { method: "POST" }).catch(() => {});
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError" && stoppedRef.current) {
        // User hit Esc — silently stop, no error toast; stopGeneration() already
        // restored their message into the input so they can fix and resend it.
      } else {
        setError(
          err instanceof DOMException && err.name === "AbortError"
            ? lang === "tr"
              ? "Yanıt çok uzun sürdü, lütfen tekrar dene."
              : "That took too long — please try again."
            : lang === "tr"
              ? "Bağlantı hatası."
              : "Connection error.",
        );
      }
    } finally {
      window.clearTimeout(timeoutId);
      controllerRef.current = null;
      setLoading(false);
      setSending(false);
    }
  }

  async function saveDraft(draftOverride?: Draft) {
    const toSave = draftOverride ?? draft;
    if (!toSave) return;
    setLoading(true);
    setError(null);
    try {
      const res =
        mode === "template"
          ? await fetch("/api/templates", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                name: toSave.title,
                sections: toSave.sections,
                lineItems: toSave.lineItems,
                contractText: toSave.contractText,
                introText: toSave.introText,
                aboutText: toSave.aboutText,
                nextSteps: toSave.nextSteps,
                billingOptions: toSave.billingOptions,
                validDays: toSave.validDays,
              }),
            })
          : await fetch(savedProposalId ? `/api/proposals/${savedProposalId}` : "/api/proposals", {
              method: savedProposalId ? "PATCH" : "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ ...toSave, paymentLink: paymentLink.trim() || undefined }),
            });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(
          data?.error ||
            (mode === "template"
              ? lang === "tr" ? "Şablon kaydedilemedi." : "Couldn't save the template."
              : lang === "tr" ? "Teklif kaydedilemedi." : "Couldn't save the proposal."),
        );
        return;
      }
      if (mode !== "template" && !savedProposalId && data?.id) setSavedProposalId(data.id);
      onSaved();
    } catch {
      setError(lang === "tr" ? "Bağlantı hatası." : "Connection error.");
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setMessages([]);
    setDraft(null);
    setPaymentLink("");
    setShowPaymentField(false);
    setSavedProposalId(null);
    setError(null);
    setOverage(null);
    setWebsiteUrl("");
    setShowWebsiteField(false);
    setAttachments([]);
    setAttachError(null);
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
      onMouseDown={(e) => {
        backdropMouseDownRef.current = e.target === e.currentTarget;
      }}
      onClick={(e) => {
        // Only close if the click started AND ended on the backdrop itself —
        // otherwise selecting a message's text and releasing the mouse past
        // the dialog's edge (a normal thing to do) closes the whole chat.
        if (e.target === e.currentTarget && backdropMouseDownRef.current) onClose();
        backdropMouseDownRef.current = false;
      }}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div
        className={cn(
          "relative flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-pop",
          dragOver && "ring-2 ring-primary",
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {dragOver && (
          <div className="pointer-events-none absolute inset-0 z-10 grid place-items-center bg-primary/5">
            <p className="rounded-lg bg-card px-4 py-2 text-sm font-medium text-primary shadow-pop">
              {lang === "tr" ? "Dosyayı buraya bırak" : "Drop the file here"}
            </p>
          </div>
        )}
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <h3 className="font-semibold">
              {onboardingPending
                ? lang === "tr" ? "Kurulum" : "Setup"
                : mode === "template"
                  ? lang === "tr" ? "AI ile şablon yaz" : "Draft a template with AI"
                  : lang === "tr" ? "AI ile teklif yaz" : "Draft with AI"}
            </h3>
          </div>
          <button
            onClick={() => {
              onClose();
              reset();
            }}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto p-5">
          {messages.length === 0 && !onboardingPending && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {lang === "tr"
                  ? "Örn: \"Acme için web sitesi tasarımı teklifi hazırla, Growth paketiyle.\""
                  : "E.g. \"Draft a website design proposal for Acme, using the Growth package.\""}
              </p>
              {!showChecklist ? (
                <button
                  onClick={() => setShowChecklist(true)}
                  className="text-xs font-medium text-primary hover:underline"
                >
                  {lang === "tr" ? "Kapsamlı teklif için bölümleri seç →" : "Pick sections for a comprehensive proposal →"}
                </button>
              ) : (
                <div className="rounded-xl border border-border bg-muted/30 p-3.5">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {lang === "tr" ? "Teklife hangi bölümler dahil olsun?" : "Which sections should the proposal include?"}
                  </p>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
                    {SECTION_OPTIONS.map((s) => (
                      <label key={s.key} className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={checkedSections[s.key]}
                          onChange={(e) => setCheckedSections((prev) => ({ ...prev, [s.key]: e.target.checked }))}
                          className="h-3.5 w-3.5 rounded border-border accent-primary"
                        />
                        {lang === "tr" ? s.tr : s.en}
                      </label>
                    ))}
                  </div>
                  <Button onClick={sendWithChecklist} disabled={loading} className="mt-3 w-full gap-2">
                    {lang === "tr" ? "Bu bölümlerle başla" : "Start with these sections"}
                  </Button>
                </div>
              )}
            </div>
          )}
          {messages.filter((m) => !m.hidden).map((m, i) => (
            <div
              key={i}
              className={cn(
                "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm",
                m.role === "user" ? "ml-auto bg-primary text-primary-foreground" : "bg-muted text-foreground",
              )}
            >
              {m.attachmentNames && m.attachmentNames.length > 0 && (
                <div className={cn("mb-1 space-y-0.5", m.role === "user" ? "text-primary-foreground/80" : "text-muted-foreground")}>
                  {m.attachmentNames.map((name, j) => (
                    <p key={j} className="flex items-center gap-1 text-xs">
                      <FileText className="h-3 w-3" />
                      {name}
                    </p>
                  ))}
                </div>
              )}
              {renderFormatted(m.content)}
            </div>
          ))}

          {sending && (
            <div className="flex w-fit items-center gap-1 rounded-2xl bg-muted px-4 py-3">
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.3s]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.15s]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground" />
            </div>
          )}

          {draft && (
            <div className="space-y-3 rounded-xl border border-primary/30 bg-primary/5 p-4">
              <h4 className="font-display text-lg font-semibold">{draft.title}</h4>
              {mode !== "template" && <p className="text-sm text-muted-foreground">{draft.client}</p>}
              {draft.sections?.map((s, i) => (
                <div key={i}>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{s.title}</p>
                  <p className="mt-1 text-sm">{s.body}</p>
                </div>
              ))}
              {draft.lineItems?.length > 0 && (
                <table className="w-full text-sm">
                  <tbody>
                    {draft.lineItems.map((li, i) => (
                      <tr key={i} className="border-t border-border">
                        <td className="py-1.5">
                          {li.name} × {li.qty}
                          {li.optional && (
                            <span className="ml-1.5 text-[10px] text-muted-foreground">
                              ({lang === "tr" ? "opsiyonel" : "optional"})
                            </span>
                          )}
                        </td>
                        <td className="py-1.5 text-right tnum">${(li.unit * li.qty).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {draft.billingOptions && draft.billingOptions.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {lang === "tr" ? "Ödeme sıklığı seçenekleri" : "Billing options"}
                  </p>
                  {draft.billingOptions.map((o) => (
                    <div key={o.key} className="rounded-lg border border-border p-2.5">
                      <p className="mb-1.5 text-xs font-medium">
                        {lang === "tr" ? o.label.tr : o.label.en} — ${o.price.toLocaleString()}
                      </p>
                      <Input
                        value={o.paymentLink ?? ""}
                        onChange={(e) => {
                          const value = e.target.value;
                          setDraft((d) =>
                            d
                              ? {
                                  ...d,
                                  billingOptions: d.billingOptions?.map((opt) =>
                                    opt.key === o.key ? { ...opt, paymentLink: value } : opt,
                                  ),
                                }
                              : d,
                          );
                        }}
                        placeholder={
                          lang === "tr"
                            ? `${lang === "tr" ? o.label.tr : o.label.en} için ödeme linki`
                            : `Payment link for ${o.label.en}`
                        }
                        className="text-xs"
                      />
                    </div>
                  ))}
                  <p className="text-xs text-muted-foreground">
                    {lang === "tr"
                      ? "Müşteri hangi seçeneği seçip imzalarsa, o seçeneğin linkine yönlendirilir."
                      : "Whichever option the client picks and signs, they're redirected to that option's link."}
                  </p>
                </div>
              )}
              {draft.contractText && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {lang === "tr" ? "Sözleşme (revize)" : "Contract (revised)"}
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-xs text-muted-foreground">{draft.contractText}</p>
                </div>
              )}
              {(!draft.billingOptions || draft.billingOptions.length === 0) &&
                (showPaymentField || paymentLink ? (
                  <div>
                    <label className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      <CreditCard className="h-3.5 w-3.5" />
                      {lang === "tr" ? "Ödeme Yöntemi (opsiyonel)" : "Payment Method (optional)"}
                    </label>
                    <Input
                      value={paymentLink}
                      onChange={(e) => setPaymentLink(e.target.value)}
                      placeholder={
                        lang === "tr"
                          ? "Ödeme linki (Ruul, Stripe, iyzico) ya da IBAN"
                          : "Payment link (Ruul, Stripe, iyzico) or IBAN"
                      }
                      className="text-sm"
                    />
                    <p className="mt-1 text-xs text-muted-foreground">
                      {lang === "tr"
                        ? "Müşteri imzaladığında buraya yönlendirilir."
                        : "The client is redirected here once they sign."}
                    </p>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowPaymentField(true)}
                    className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary"
                  >
                    <CreditCard className="h-3.5 w-3.5" />
                    {lang === "tr" ? "Ödeme linki ekle (opsiyonel)" : "Add a payment link (optional)"}
                  </button>
                ))}
              <Button onClick={() => saveDraft()} disabled={loading} className="w-full gap-2">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                {mode === "template"
                  ? lang === "tr" ? "Şablon olarak kaydet" : "Save as template"
                  : savedProposalId
                    ? lang === "tr" ? "Değişiklikleri kaydet" : "Save changes"
                    : lang === "tr" ? "Teklife ekle" : "Add to proposals"}
              </Button>
              {savedProposalId && mode !== "template" && (
                <p className="text-center text-xs text-success">
                  {lang === "tr" ? "✓ Kaydedildi — düzenlemeye devam edebilirsin." : "✓ Saved — you can keep editing."}
                </p>
              )}
            </div>
          )}

          {error && (
            <div className="space-y-2 rounded-xl border border-destructive/30 bg-destructive/5 p-3">
              <p className="text-sm text-destructive">{error}</p>
              {overage && (
                overage.link ? (
                  <a
                    href={overage.link}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground hover:opacity-90"
                  >
                    <CreditCard className="h-3.5 w-3.5" />
                    {lang === "tr"
                      ? `$${overage.price} öde, +${overage.drafts} teklif hakkı al`
                      : `Pay $${overage.price} for +${overage.drafts} more drafts`}
                  </a>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    {lang === "tr"
                      ? "Devam etmek için bizimle iletişime geç."
                      : "Contact us to continue."}
                  </p>
                )
              )}
            </div>
          )}
          <div ref={endRef} />
        </div>

        <div className="space-y-2 border-t border-border p-4">
            {showWebsiteField ? (
              <Input
                value={websiteUrl}
                onChange={(e) => setWebsiteUrl(e.target.value)}
                placeholder={lang === "tr" ? "https://musteri-sitesi.com/iletisim" : "https://client-site.com/contact"}
                className="text-sm"
              />
            ) : (
              <button
                onClick={() => setShowWebsiteField(true)}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary"
              >
                <Link2 className="h-3.5 w-3.5" />
                {lang === "tr"
                  ? "Müşterinin iletişim/hakkımızda sayfasını paylaş (opsiyonel)"
                  : "Share client's contact/about page (optional)"}
              </button>
            )}
            {attachments.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {attachments.map((a, i) => (
                  <div key={i} className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-2.5 py-1.5 text-xs">
                    <FileText className="h-3.5 w-3.5 shrink-0 text-primary" />
                    <span className="min-w-0 max-w-[160px] truncate">{a.name}</span>
                    <button
                      onClick={() => setAttachments((prev) => prev.filter((_, j) => j !== i))}
                      className="shrink-0 text-muted-foreground hover:text-destructive"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            {attachError && <p className="text-xs text-destructive">{attachError}</p>}
            <div className="flex items-end gap-2">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="application/pdf,image/png,image/jpeg,image/webp,image/gif"
                onChange={handleFileSelect}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={loading}
                title={lang === "tr" ? "Dosya ekle (PDF, resim)" : "Attach a file (PDF, image)"}
                className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-muted disabled:opacity-50"
              >
                <Paperclip className="h-4 w-4" />
              </button>
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
                onPaste={handlePaste}
                placeholder={
                  sending
                    ? lang === "tr"
                      ? "Seely yazıyor… (durdurmak için Esc)"
                      : "Seely is typing… (Esc to stop)"
                    : lang === "tr"
                      ? "Mesajını yaz… (resim yapıştırabilirsin, yeni satır için Shift+Enter)"
                      : "Type a message… (you can paste an image, Shift+Enter for a new line)"
                }
                disabled={loading}
                rows={2}
                className={cn(
                  "flex w-full resize-none rounded-3xl border border-input px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-ring transition-colors",
                  loading ? "bg-muted opacity-70 cursor-not-allowed" : "bg-card",
                )}
              />
              <Button
                size="icon"
                onClick={loading ? stopGeneration : () => send()}
                disabled={false}
                title={loading ? (lang === "tr" ? "Durdur (Esc)" : "Stop (Esc)") : undefined}
              >
                {loading ? <X className="h-4 w-4" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
