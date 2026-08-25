"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { Sparkles, X, Send, Loader2, Check, Link2, CreditCard, Paperclip, FileText, Mic, MicOff, ArrowLeft, BookmarkPlus, PenLine, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLang } from "@/components/i18n/language-provider";
import { usePlan } from "@/components/app/plan-provider";
import { planAllows } from "@/lib/plan";
import { cn } from "@/lib/utils";
import { legacyToBlocks } from "@/lib/proposal-blocks/convert-legacy";
import { BlockRenderer } from "@/components/app/blocks/block-renderer";
import type { ProposalBlock } from "@/lib/types/proposal-blocks";
import { templates as demoTemplates } from "@/lib/demo/data";
import { useDraftStream } from "@/lib/hooks/use-draft-stream";

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
  sections: { title: string; body: string; videoUrl?: string }[];
  lineItems: { name: string; qty: number; unit: number; optional?: boolean; included?: boolean }[];
  billingOptions?: BillingOption[];
  nextSteps?: { title: string; body: string }[];
  validDays?: number;
  contractText?: string;
  confirmed?: boolean;
  /** Typed blocks (see lib/types/proposal-blocks.ts) — currently only ever populated
   *  with "Legal" blocks the AI pulled from the Content Library (see
   *  add_legal_block_to_proposal in app/api/draft-proposal/route.ts). Editing one here
   *  only ever mutates this in-memory draft; saving PATCHes it into THIS proposal's
   *  `blocks` column, never back into `company_documents`. */
  blocks?: ProposalBlock[];
  /** Per-template visual theme (e.g. from the construction template) — passed through untouched. */
  themeJson?: { primaryColor: string; accentColor: string; font?: string };
  /** How the recipient views this proposal — "pages" (sidebar, one section at a time, like a
   *  small site) or "scroll" (one long page, classic top nav). Defaults to "pages". */
  viewMode?: "pages" | "scroll";
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
/** Splits on ".", "!", "?" only when followed by whitespace or end-of-string —
 * a period inside "testajans.com" or "örn." isn't followed by a space, so it's
 * left alone instead of being treated as a sentence break. Uses a lookahead
 * (not a consuming match) so no trailing text can ever go missing, unlike a
 * match-and-reconstruct approach. */
function splitSentences(line: string): string[] {
  const parts: string[] = [];
  let last = 0;
  const re = /[.!?](?=\s+|$)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(line))) {
    parts.push(line.slice(last, m.index + 1).trim());
    last = m.index + 1;
  }
  if (last < line.length) parts.push(line.slice(last).trim());
  return parts.filter(Boolean);
}

function splitIntoSentenceBubbles(text: string): string[] {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const rawParts: string[] = [];
  for (const line of lines) {
    if (/^(\d+\.|[-•])\s/.test(line)) {
      rawParts.push(line);
    } else {
      for (const s of splitSentences(line)) rawParts.push(s);
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

/** Reveals `text` character-by-character with a trailing blinking pencil cursor
 * while `typing` is true (simulates Seely "writing" the block live on the
 * canvas). Once `typing` flips false, or the text has already been fully
 * revealed once for this `revealKey`, it just renders the plain text — so a
 * user editing the field afterwards never fights the animation. */
function TypeReveal({
  text,
  typing,
  revealKey,
  speed = 14,
  className,
}: {
  text: string;
  typing: boolean;
  revealKey: string | number;
  speed?: number;
  className?: string;
}) {
  const [shown, setShown] = useState(typing ? "" : text);
  const doneKeysRef = useRef<Set<string | number>>(new Set());

  useEffect(() => {
    if (!typing || doneKeysRef.current.has(revealKey)) {
      setShown(text);
      return;
    }
    let i = 0;
    setShown("");
    const step = Math.max(1, Math.round(text.length / 90));
    const id = window.setInterval(() => {
      i += step;
      setShown(text.slice(0, i));
      if (i >= text.length) {
        window.clearInterval(id);
        doneKeysRef.current.add(revealKey);
        setShown(text);
      }
    }, speed);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revealKey, text]);

  const finished = shown.length >= text.length;
  return (
    <span className={className}>
      {shown}
      {typing && !finished && (
        <span className="relative ml-0.5 inline-block h-[1em] w-[2px] -translate-y-[1px] animate-pulse bg-current align-middle" />
      )}
    </span>
  );
}

/** contentEditable span used across the canvas for inline WYSIWYG edits — click
 * to place a caret, edits commit onBlur. Disabled while Seely is still writing
 * (typing=true) so the user can't fight the reveal animation mid-stream. */
function Editable({
  value,
  onChange,
  className,
  as: Tag = "div",
  disabled,
  placeholder,
}: {
  value: string;
  onChange: (next: string) => void;
  className?: string;
  as?: "div" | "span" | "h1" | "h2" | "h3" | "p";
  disabled?: boolean;
  placeholder?: string;
}) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    if (ref.current && ref.current.innerText !== value) ref.current.innerText = value;
  }, [value]);
  return (
    <Tag
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ref={ref as any}
      contentEditable={!disabled}
      suppressContentEditableWarning
      onBlur={(e) => onChange((e.target as HTMLElement).innerText)}
      data-placeholder={placeholder}
      className={cn(
        "outline-none transition-colors empty:before:text-current/30 empty:before:content-[attr(data-placeholder)]",
        !disabled && "cursor-text rounded-sm hover:bg-black/[0.03] focus:bg-black/[0.04] focus:ring-1 focus:ring-inset focus:ring-current/20",
        className,
      )}
    >
      {value}
    </Tag>
  );
}

/** Deterministic decorative "photo" panel — a gradient + subtle geometric pattern
 * standing in for client photography, since Seely has no image source yet. Color
 * is derived from the proposal's theme, or falls back to the primary brand gradient. */
function PhotoBlock({ seed, color, className }: { seed: string; color?: string; className?: string }) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  const hue = hash % 360;
  const bg = color
    ? `linear-gradient(135deg, ${color}dd, ${color}55)`
    : `linear-gradient(135deg, oklch(62% 0.14 ${hue}), oklch(48% 0.16 ${(hue + 40) % 360}))`;
  return (
    <div className={cn("relative overflow-hidden", className)} style={{ background: bg }}>
      <svg className="absolute inset-0 h-full w-full opacity-25" preserveAspectRatio="xMidYMid slice">
        <defs>
          <pattern id={`grid-${hash}`} width="28" height="28" patternUnits="userSpaceOnUse">
            <circle cx="2" cy="2" r="1.4" fill="white" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill={`url(#grid-${hash})`} />
      </svg>
      <div className="absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-white/10" />
    </div>
  );
}

export function AiDraftDialog({
  open,
  onClose,
  onSaved,
  mode = "proposal",
  initialTemplateId,
  resumeProposalId,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  /** "template" builds/saves a reusable template (POST /api/templates) instead of a proposal. */
  mode?: "proposal" | "template";
  /** Set when drafting a new proposal from a template ("Bu şablonla yaz") — the AI resolves
   *  this id server-side and drafts real content from it instead of us dumping raw text. */
  initialTemplateId?: string;
  /** Set when reopening a saved draft (e.g. "AI ile devam et" on a Taslak-status proposal
   *  in the list) — loads that proposal's data into the preview and continues chatting
   *  against it (PATCHes instead of creating a new one). */
  resumeProposalId?: string;
}) {
  const { lang } = useLang();
  const plan = usePlan();
  const [mounted, setMounted] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [activeTemplateId, setActiveTemplateId] = useState<string | undefined>(initialTemplateId);
  const [selectedFormat, setSelectedFormat] = useState<"pdf" | "html" | undefined>(undefined);
  const [recentTemplates, setRecentTemplates] = useState<{ id: string; name: string }[]>([]);
  const [input, setInput] = useState("");
  const [recording, setRecording] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [speechSupported, setSpeechSupported] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [showWebsiteField, setShowWebsiteField] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [paymentLink, setPaymentLink] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [overage, setOverage] = useState<{ link: string | null; price: number; drafts: number } | null>(null);
  // Once set, "Teklife ekle" becomes "Değişiklikleri kaydet" and saves PATCH this
  // proposal instead of creating a new one — the dialog stays open and chattable
  // after the first save so the user can keep refining it, on every plan.
  const [savedProposalId, setSavedProposalId] = useState<string | null>(null);
  // Authenticated "sign on behalf of the company" state for Legal/ContractSignOff
  // blocks in the preview below — only usable once the proposal is saved, since
  // block_signatures rows need a real proposal_id (see savedProposalId above).
  const [companySignatures, setCompanySignatures] = useState<Record<string, { signerName: string; signedAt: string }>>({});
  const [companySigningBlockId, setCompanySigningBlockId] = useState<string | null>(null);
  const [companySignErrors, setCompanySignErrors] = useState<Record<string, string>>({});
  // "Sign on behalf of company" clicked before the proposal has a real id yet — queued
  // here instead of silently doing nothing, and flushed once saveDraft() gets an id back.
  const [pendingCompanySign, setPendingCompanySign] = useState<Record<string, "Legal" | "ContractSignOff">>({});
  const [showSaveTemplateField, setShowSaveTemplateField] = useState(false);
  const [templateSaveName, setTemplateSaveName] = useState("");
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [templateSaved, setTemplateSaved] = useState(false);
  const [savedSectionIndexes, setSavedSectionIndexes] = useState<Record<number, boolean>>({});
  const [savingSectionIndex, setSavingSectionIndex] = useState<number | null>(null);
  const [savedLibraryBlockIds, setSavedLibraryBlockIds] = useState<Record<string, boolean>>({});
  const [savingLibraryBlockId, setSavingLibraryBlockId] = useState<string | null>(null);
  const [showLibraryUpsell, setShowLibraryUpsell] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [attachError, setAttachError] = useState<string | null>(null);
  // Fetched fresh each time the dialog opens — whether this company still needs
  // Seely's first-chat intro (companies.onboarding_completed === false).
  const [onboardingPending, setOnboardingPending] = useState(false);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  // Mobile-only Chat/Preview tab switch for the split-view layout below —
  // purely presentational, doesn't affect any drafting logic.
  const [mobilePanel, setMobilePanel] = useState<"chat" | "preview">("chat");
  // Bumped every time a fresh draft lands from the AI (not on local edits) — used
  // as the TypeReveal `revealKey` so the "live writing" animation only plays once
  // per generation, never replays when the user just clicks around afterwards.
  const [draftGen, setDraftGen] = useState(0);
  const [canvasTyping, setCanvasTyping] = useState(false);
  const canvasTypingTimeoutRef = useRef<number | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const stoppedRef = useRef(false);
  const backdropMouseDownRef = useRef(false);
  const draftStream = useDraftStream();
  /** Progressive-disclosure chip prompt from the v2 Clarifier (see
   *  AI-ARCHITECTURE-V2.md §5) — rendered as tappable chips right under the
   *  chat instead of making the user type a full sentence back. */
  const [clarify, setClarify] = useState<{
    question: { tr: string; en: string };
    chips: { key: string; label: { tr: string; en: string } }[];
    multiSelect?: boolean;
  } | null>(null);
  const [clarifySelection, setClarifySelection] = useState<string[]>([]);

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
  // Sector chips (empty-state, before the first message) — clicking one just sets
  // activeTemplateId for the NEXT request; it doesn't send anything by itself, and
  // doesn't touch the user's saved default template (/api/settings/default-template).
  const SECTOR_CHIPS: { emoji: string; tr: string; en: string; templateId?: string }[] = [
    { emoji: "🔨", tr: "Tadilat", en: "Renovation", templateId: demoTemplates.find((t) => t.sector === "construction")?.id },
    { emoji: "💻", tr: "Yazılım", en: "Software", templateId: demoTemplates.find((t) => t.sector === "software")?.id },
    { emoji: "💼", tr: "Danışmanlık", en: "Consulting", templateId: demoTemplates.find((t) => t.sector === "consulting")?.id },
    { emoji: "📊", tr: "Muhasebe", en: "Accounting", templateId: demoTemplates.find((t) => t.sector === "accounting")?.id },
    { emoji: "🔍", tr: "Denetim", en: "Audit", templateId: demoTemplates.find((t) => t.sector === "audit")?.id },
    { emoji: "🏢", tr: "Kurumsal Yazılım", en: "Enterprise Software", templateId: demoTemplates.find((t) => t.sector === "enterprise_software")?.id },
    { emoji: "🎯", tr: "Koçluk / Yön. Danışmanlığı", en: "Coaching / Advisory", templateId: demoTemplates.find((t) => t.sector === "coaching")?.id },
    { emoji: "💰", tr: "Finansal Hizmetler", en: "Financial Services", templateId: demoTemplates.find((t) => t.sector === "financial_services")?.id },
    { emoji: "🧑‍💼", tr: "İnsan Kaynakları", en: "Human Resources", templateId: demoTemplates.find((t) => t.sector === "hr_consulting")?.id },
    { emoji: "📈", tr: "Pazar Araştırması", en: "Market Research", templateId: demoTemplates.find((t) => t.sector === "market_research")?.id },
    { emoji: "📄", tr: "Varsayılan", en: "Default", templateId: undefined },
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

  function toggleRecording() {
    if (recording) {
      recognitionRef.current?.stop();
      return;
    }
    setVoiceError(null);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setVoiceError(
        lang === "tr"
          ? "Tarayıcın ses tanımayı desteklemiyor — Chrome veya Edge'de dener misin?"
          : "Your browser doesn't support voice input — try Chrome or Edge.",
      );
      return;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const recognition: any = new SpeechRecognition();
    recognition.lang = lang === "tr" ? "tr-TR" : "en-US";
    recognition.interimResults = false;
    recognition.continuous = false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onresult = (e: any) => {
      const transcript = Array.from(e.results as ArrayLike<{ 0: { transcript: string } }>)
        .map((r) => r[0].transcript)
        .join(" ");
      setInput((prev) => (prev ? `${prev} ${transcript}` : transcript));
    };
    recognition.onerror = () => {
      setVoiceError(lang === "tr" ? "Ses tanınamadı, tekrar dener misin?" : "Couldn't recognize speech — try again?");
      setRecording(false);
    };
    recognition.onend = () => setRecording(false);
    recognitionRef.current = recognition;
    recognition.start();
    setRecording(true);
  }

  // Just prevents the browser's default "navigate to the dropped file"
  // behavior — no visual drag-over state. Detecting "is this actually a file
  // being dragged" via dataTransfer.types is unreliable across browsers (it
  // can report "Files" during a plain text-selection drag), so a "drop a
  // file here" banner that pops up on any old drag is more confusing than
  // helpful. The paperclip button already communicates that attaching is
  // possible; a real file drop is still accepted silently by handleDrop.
  function handleDragOver(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
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

  // Full-screen focus mode: hide the dashboard behind it entirely rather than
  // dimming it, so the composer/canvas is the only thing on screen.
  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  useEffect(() => {
    // Feature-detect rather than sniff the UA — iOS (Safari and every other
    // browser there, since all are required to use WebKit) has no
    // SpeechRecognition implementation at all, so this naturally hides the
    // mic button there instead of showing a button that always errors.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setSpeechSupported(!!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition));
  }, []);

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
    };
  }, []);

  useEffect(() => {
    if (!open || !initialTemplateId || resumeProposalId || messages.length > 0) return;
    setActiveTemplateId(initialTemplateId);
    rememberRecentTemplate(initialTemplateId);
    // Kick off the chat ourselves — the AI resolves the template server-side and
    // drafts real content from it (blended with the company's own doc library,
    // if any) instead of us dumping raw template text into the preview.
    // (templateIdOverride: setActiveTemplateId above hasn't re-rendered yet when
    // send() reads state synchronously, so pass it explicitly too.)
    send(lang === "tr" ? "Bu şablonu kullanmak istiyorum." : "I'd like to use this template.", {
      templateIdOverride: initialTemplateId,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialTemplateId]);

  // "Son kullanılan şablonlar" strip (Custom/Pro only) — a lightweight
  // localStorage-backed recency list, no DB changes needed. Loaded once per
  // open; clicking a thumbnail starts a fresh draft from that template.
  useEffect(() => {
    if (!open || !planAllows(plan, "templates_create") || messages.length > 0) return;
    try {
      const recentIds: string[] = JSON.parse(localStorage.getItem("seelydeal:recent-templates") ?? "[]");
      if (recentIds.length === 0) return;
      fetch("/api/templates")
        .then((r) => r.json())
        .then((d) => {
          const byId = new Map((d.templates ?? []).map((t: { id: string; name: string }) => [t.id, t.name]));
          setRecentTemplates(
            recentIds
              .filter((id) => byId.has(id))
              .slice(0, 5)
              .map((id) => ({ id, name: byId.get(id) as string })),
          );
        })
        .catch(() => {});
    } catch {
      // localStorage unavailable (private mode etc.) — just skip the strip.
    }
  }, [open, plan, messages.length]);

  async function handleCompanySign(blockId: string, blockType: "Legal" | "ContractSignOff", proposalIdOverride?: string) {
    const proposalId = proposalIdOverride ?? savedProposalId;
    if (!proposalId) {
      // No id yet — the proposal hasn't been saved for the first time. Queue the
      // intent instead of dropping it; saveDraft() flushes this once it has an id.
      setPendingCompanySign((prev) => ({ ...prev, [blockId]: blockType }));
      return;
    }
    setCompanySigningBlockId(blockId);
    setCompanySignErrors((prev) => ({ ...prev, [blockId]: "" }));
    try {
      const res = await fetch(`/api/proposals/${proposalId}/blocks/${blockId}/company-sign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ blockType }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || (lang === "tr" ? "İmzalanamadı." : "Couldn't sign."));
      setCompanySignatures((prev) => ({
        ...prev,
        [blockId]: { signerName: data.signature.signer_name, signedAt: data.signature.signed_at },
      }));
    } catch (e) {
      setCompanySignErrors((prev) => ({ ...prev, [blockId]: e instanceof Error ? e.message : String(e) }));
    } finally {
      setCompanySigningBlockId(null);
      setPendingCompanySign((prev) => {
        if (!(blockId in prev)) return prev;
        const next = { ...prev };
        delete next[blockId];
        return next;
      });
    }
  }

  function getCompanySignState(blockId: string, blockType: "Legal" | "ContractSignOff") {
    return {
      signature: companySignatures[blockId] ?? null,
      signing: companySigningBlockId === blockId || blockId in pendingCompanySign,
      onSign: () => handleCompanySign(blockId, blockType),
      error: companySignErrors[blockId] || null,
    };
  }

  function rememberRecentTemplate(id: string) {
    try {
      const recentIds: string[] = JSON.parse(localStorage.getItem("seelydeal:recent-templates") ?? "[]");
      const next = [id, ...recentIds.filter((x) => x !== id)].slice(0, 5);
      localStorage.setItem("seelydeal:recent-templates", JSON.stringify(next));
    } catch {
      // ignore
    }
  }

  function useRecentTemplate(id: string, name: string) {
    setActiveTemplateId(id);
    rememberRecentTemplate(id);
    send(
      lang === "tr" ? `"${name}" şablonunu kullanmak istiyorum.` : `I'd like to use the "${name}" template.`,
      { templateIdOverride: id },
    );
  }

  useEffect(() => {
    if (!open || initialTemplateId || resumeProposalId) return;
    fetch("/api/settings/onboarding")
      .then((r) => r.json())
      .then((d) => {
        setOnboardingPending(d.onboardingCompleted === false);
        if (d.defaultSections) setCheckedSections(d.defaultSections);
      })
      .catch(() => {});
  }, [open, initialTemplateId, resumeProposalId]);

  useEffect(() => {
    if (!open || !resumeProposalId || messages.length > 0) return;
    fetch(`/api/proposals/${resumeProposalId}`)
      .then((r) => r.json())
      .then((data) => {
        const row = data.proposal;
        if (!row) return;
        const loadedDraft: Draft = {
          title: row.title,
          client: row.clients?.name ?? "",
          value: row.value ?? 0,
          introText: row.intro_text ?? undefined,
          aboutText: row.about_text ?? undefined,
          clientContact: row.client_contact ?? undefined,
          sections: row.sections ?? [],
          lineItems: row.line_items ?? [],
          billingOptions: row.billing_options ?? undefined,
          nextSteps: row.next_steps ?? undefined,
          validDays: row.valid_days ?? undefined,
          contractText: row.contract_text ?? undefined,
          themeJson: row.theme_json ?? undefined,
        };
        setDraft(loadedDraft);
        setSavedProposalId(resumeProposalId);
        setPaymentLink(row.payment_link ?? "");
        setMessages([
          {
            role: "assistant",
            content:
              lang === "tr"
                ? `Kaldığımız yerden devam ediyoruz: "${row.title}". Ne değiştirmek istersin?`
                : `Picking up where we left off: "${row.title}". What would you like to change?`,
          },
        ]);
      })
      .catch(() => setError(lang === "tr" ? "Taslak yüklenemedi." : "Couldn't load the draft."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, resumeProposalId]);

  /** Esc while Seely is replying stops the request and puts the last message back
   * in the input so the user can fix a typo/instruction and resend — mirrors how
   * Esc interrupts an in-progress agent turn here in Claude Code. */
  function stopGeneration() {
    if (!loading) return;
    stoppedRef.current = true;
    draftStream.stop();
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

  async function send(override?: string, opts?: { hidden?: boolean; templateIdOverride?: string }) {
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
    setClarify(null);
    setClarifySelection([]);

    stoppedRef.current = false;
    const timeoutId = window.setTimeout(() => draftStream.stop(), 130_000);

    const requestPayload = {
      messages: next.map(({ role, content }) => ({ role, content })),
      websiteUrl: websiteUrl || undefined,
      attachments: sentAttachments.length ? sentAttachments : undefined,
      currentDraft: draft ?? undefined,
      templateId: !draft ? opts?.templateIdOverride ?? activeTemplateId : undefined,
    };

    // A dropped connection/transient network blip shouldn't dead-end the user
    // in an error box — silently retry once before actually surfacing it.
    async function sendWithRetry(attempt = 1) {
      try {
        return await draftStream.send(requestPayload);
      } catch (err) {
        if (attempt < 2 && !(err instanceof DOMException && err.name === "AbortError")) {
          await sleep(1200);
          return sendWithRetry(attempt + 1);
        }
        throw err;
      }
    }

    try {
      const data = await sendWithRetry();
      if (data.clarify) {
        setClarify(data.clarify);
        if (data.reply.trim()) setMessages((m) => [...m, { role: "assistant", content: data.reply }]);
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
        const nextDraft = {
          ...data.draft,
          themeJson: data.draft.themeJson ?? draft?.themeJson,
          viewMode: data.draft.viewMode ?? draft?.viewMode ?? "pages",
        };
        setDraft(nextDraft);
        setDraftGen((g) => g + 1);
        setCanvasTyping(true);
        if (canvasTypingTimeoutRef.current) window.clearTimeout(canvasTypingTimeoutRef.current);
        canvasTypingTimeoutRef.current = window.setTimeout(() => setCanvasTyping(false), 3200);
        // The model only sets this after the user explicitly confirmed the final
        // proposal in chat — save it immediately instead of waiting for a manual click.
        // Pass this turn's format directly (rather than relying on selectedFormat
        // state, which won't have re-rendered yet if the format block arrived in
        // this same response) so a same-turn confirm doesn't save format: undefined.
        if (data.draft.confirmed) {
          saveDraft(nextDraft, data.format === "pdf" || data.format === "html" ? data.format : undefined);
        }
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
        if (data.brand.address || data.brand.phone) {
          fetch("/api/settings/contact-info", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ address: data.brand.address, phone: data.brand.phone }),
          })
            .then(async (r) => {
              if (!r.ok) {
                const d = await r.json().catch(() => null);
                setError(d?.error || (lang === "tr" ? "Adres/telefon kaydedilemedi." : "Couldn't save the address/phone."));
              }
            })
            .catch(() => setError(lang === "tr" ? "Adres/telefon kaydedilemedi." : "Couldn't save the address/phone."));
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
        if (data.brand.defaultTemplateContent) {
          fetch("/api/settings/default-template", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ content: data.brand.defaultTemplateContent }),
          })
            .then(async (r) => {
              if (!r.ok) {
                const d = await r.json().catch(() => null);
                setError(d?.error || (lang === "tr" ? "Varsayılan şablon kaydedilemedi." : "Couldn't save the default template."));
              }
            })
            .catch(() => setError(lang === "tr" ? "Varsayılan şablon kaydedilemedi." : "Couldn't save the default template."));
        }
        if (data.brand.defaultSections) {
          setCheckedSections(data.brand.defaultSections);
          fetch("/api/settings/default-sections", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sections: data.brand.defaultSections }),
          })
            .then(async (r) => {
              if (!r.ok) {
                const d = await r.json().catch(() => null);
                setError(d?.error || (lang === "tr" ? "Varsayılan bölümler kaydedilemedi." : "Couldn't save the default sections."));
              }
            })
            .catch(() => setError(lang === "tr" ? "Varsayılan bölümler kaydedilemedi." : "Couldn't save the default sections."));
        }
      }
      if (data.onboarding?.completed) {
        setOnboardingPending(false);
        fetch("/api/settings/onboarding", { method: "POST" }).catch(() => {});
      }
      if (data.format === "pdf" || data.format === "html") {
        setSelectedFormat(data.format);
      }
      if (data.userDefault?.label) {
        fetch("/api/settings/user-default", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            label: data.userDefault.label,
            templateId: data.userDefault.templateId ?? activeTemplateId,
            preferredFormat: data.userDefault.preferredFormat ?? selectedFormat,
          }),
        })
          .then((res) => {
            if (!res.ok) setError(lang === "tr" ? "Kişisel varsayılan kaydedilemedi." : "Couldn't save your personal default.");
          })
          .catch(() => setError(lang === "tr" ? "Kişisel varsayılan kaydedilemedi." : "Couldn't save your personal default."));
      }
      if (data.addClient?.name) {
        fetch("/api/clients", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: data.addClient.name, email: data.addClient.email, website: data.addClient.website }),
        })
          .then((res) => {
            if (!res.ok) setError(lang === "tr" ? "Müşteri eklenemedi." : "Couldn't add the client.");
          })
          .catch(() => setError(lang === "tr" ? "Müşteri eklenemedi." : "Couldn't add the client."));
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError" && stoppedRef.current) {
        // User hit Esc — silently stop, no error toast; stopGeneration() already
        // restored their message into the input so they can fix and resend it.
      } else if (err instanceof Error && (err as { status?: number }).status === 429) {
        const e = err as Error & { overageLink?: string | null; overagePrice?: number; overageDrafts?: number };
        setError(e.message);
        setOverage({ link: e.overageLink ?? null, price: e.overagePrice ?? 0, drafts: e.overageDrafts ?? 0 });
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
      setLoading(false);
      setSending(false);
    }
  }

  async function saveDraft(draftOverride?: Draft, formatOverride?: "pdf" | "html"): Promise<boolean> {
    const toSave = draftOverride ?? draft;
    if (!toSave) return false;
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
                blocks: toSave.blocks,
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
              body: JSON.stringify({
                ...toSave,
                paymentLink: paymentLink.trim() || undefined,
                templateId: activeTemplateId,
                format: formatOverride ?? selectedFormat,
              }),
            });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(
          data?.error ||
            (mode === "template"
              ? lang === "tr" ? "Şablon kaydedilemedi." : "Couldn't save the template."
              : lang === "tr" ? "Teklif kaydedilemedi." : "Couldn't save the proposal."),
        );
        return false;
      }
      if (mode !== "template" && !savedProposalId && data?.id) {
        setSavedProposalId(data.id);
        // Flush any "sign on behalf of company" clicks made before this first save —
        // block_signatures needs a real proposal_id, so those were queued until now.
        Object.entries(pendingCompanySign).forEach(([blockId, blockType]) => {
          handleCompanySign(blockId, blockType, data.id);
        });
      }
      onSaved();
      return true;
    } catch {
      setError(lang === "tr" ? "Bağlantı hatası." : "Connection error.");
      return false;
    } finally {
      setLoading(false);
    }
  }

  /** Saves the current draft (in normal "proposal" mode) as a reusable template too — a
   *  secondary action alongside actually adding it to /proposals. Reuses the same
   *  /api/templates endpoint the dedicated template-building mode already posts to. */
  async function saveAsTemplate() {
    if (!draft) return;
    setSavingTemplate(true);
    setError(null);
    try {
      const res = await fetch("/api/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: templateSaveName.trim() || draft.title,
          sections: draft.sections,
          lineItems: draft.lineItems,
          contractText: draft.contractText,
          introText: draft.introText,
          aboutText: draft.aboutText,
          nextSteps: draft.nextSteps,
          billingOptions: draft.billingOptions,
          validDays: draft.validDays,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error || (lang === "tr" ? "Taslak olarak kaydedilemedi." : "Couldn't save as a template."));
        return;
      }
      setTemplateSaved(true);
      setShowSaveTemplateField(false);
    } catch {
      setError(lang === "tr" ? "Bağlantı hatası." : "Connection error.");
    } finally {
      setSavingTemplate(false);
    }
  }

  /** Saves a single section's title/body as a reusable content block in the company's
   *  library (İçerik Kütüphanesi → "Hazır İçerikler") via /api/company-documents.
   *  Lite plans never reach the fetch — /content and the AI tool layer both already
   *  gate on document_library, so this keeps the editor consistent with those. */
  async function saveSectionToLibrary(index: number, title: string, body: string) {
    if (!planAllows(plan, "document_library")) {
      setShowLibraryUpsell(true);
      return;
    }
    setSavingSectionIndex(index);
    try {
      const res = await fetch("/api/company-documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, content: body }),
      });
      if (res.ok) setSavedSectionIndexes((s) => ({ ...s, [index]: true }));
      else {
        const data = await res.json().catch(() => null);
        setError(data?.error || (lang === "tr" ? "Kütüphaneye eklenemedi." : "Couldn't add to the library."));
      }
    } catch {
      setError(lang === "tr" ? "Bağlantı hatası." : "Connection error.");
    } finally {
      setSavingSectionIndex(null);
    }
  }

  /** Same as saveSectionToLibrary but for a typed block (currently "Legal") rendered
   *  via BlockRenderer — see onSaveToLibrary in block-renderer.tsx. */
  async function saveBlockToLibrary(blockId: string, title: string, content: string) {
    if (!planAllows(plan, "document_library")) {
      setShowLibraryUpsell(true);
      return;
    }
    setSavingLibraryBlockId(blockId);
    try {
      const res = await fetch("/api/company-documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, content }),
      });
      if (res.ok) setSavedLibraryBlockIds((s) => ({ ...s, [blockId]: true }));
      else {
        const data = await res.json().catch(() => null);
        setError(data?.error || (lang === "tr" ? "Kütüphaneye eklenemedi." : "Couldn't add to the library."));
      }
    } catch {
      setError(lang === "tr" ? "Bağlantı hatası." : "Connection error.");
    } finally {
      setSavingLibraryBlockId(null);
    }
  }

  function reset() {
    setMessages([]);
    setDraft(null);
    setPaymentLink("");
    setSavedProposalId(null);
    setError(null);
    setOverage(null);
    setWebsiteUrl("");
    setShowWebsiteField(false);
    setAttachments([]);
    setAttachError(null);
    setShowCloseConfirm(false);
    setShowSaveTemplateField(false);
    setTemplateSaveName("");
    setTemplateSaved(false);
    setSavedSectionIndexes({});
  }

  /** Closing mid-chat with an unsaved draft (never explicitly confirmed/saved) would
   * silently throw away real work — ask first, mode === "template" has nothing
   * equivalent to a "Taslak" pipeline stage so it skips straight to closing. */
  function requestClose() {
    if (mode === "proposal" && draft && !savedProposalId) {
      setShowCloseConfirm(true);
      return;
    }
    onClose();
    reset();
  }

  async function confirmCloseAndSave() {
    const ok = await saveDraft();
    if (!ok) return; // error is already shown inline — let them retry or discard instead
    onClose();
    reset();
  }

  function confirmCloseWithoutSaving() {
    onClose();
    reset();
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex flex-col overflow-hidden bg-[#0b0d12]"
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Top-dropping toast strip — the only thing allowed to interrupt the
         full-screen focus mode. Never blocks the canvas or composer below it. */}
      <div className="pointer-events-none fixed inset-x-0 top-0 z-[130] flex flex-col items-center gap-2 p-3">
        {error && (
          <div className="pointer-events-auto flex w-full max-w-md items-start gap-2.5 rounded-xl border border-destructive/30 bg-card/95 px-4 py-3 shadow-pop backdrop-blur animate-in fade-in slide-in-from-top-4 duration-300">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
            <div className="min-w-0 flex-1 space-y-1.5">
              <p className="text-xs text-foreground">{error}</p>
              {overage && (
                overage.link ? (
                  <a
                    href={overage.link}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex h-7 items-center gap-1.5 rounded-lg bg-primary px-2.5 text-[11px] font-semibold text-primary-foreground hover:opacity-90"
                  >
                    <CreditCard className="h-3 w-3" />
                    {lang === "tr" ? `$${overage.price} öde, +${overage.drafts} teklif hakkı al` : `Pay $${overage.price} for +${overage.drafts} more drafts`}
                  </a>
                ) : (
                  <p className="text-[11px] text-muted-foreground">{lang === "tr" ? "Devam etmek için bizimle iletişime geç." : "Contact us to continue."}</p>
                )
              )}
            </div>
            <button onClick={() => { setError(null); setOverage(null); }} className="shrink-0 rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
        {attachError && (
          <div className="pointer-events-auto flex w-full max-w-md items-center gap-2.5 rounded-xl border border-destructive/30 bg-card/95 px-4 py-2.5 text-xs text-destructive shadow-pop backdrop-blur animate-in fade-in slide-in-from-top-4 duration-300">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            {attachError}
          </div>
        )}
      </div>

      <div
        className="relative flex min-h-0 flex-1 flex-col bg-card"
        onClick={(e) => e.stopPropagation()}
      >
        {showLibraryUpsell && (
          <div className="absolute inset-0 z-20 flex items-center justify-center rounded-2xl bg-black/40 p-6" onClick={() => setShowLibraryUpsell(false)}>
            <div className="w-full max-w-sm space-y-3 rounded-xl border border-border bg-card p-5 shadow-pop" onClick={(e) => e.stopPropagation()}>
              <p className="text-sm font-medium">{lang === "tr" ? "İçerik Kütüphanesi Pro'da" : "Content Library is a Pro feature"}</p>
              <p className="text-xs text-muted-foreground">
                {lang === "tr"
                  ? "Bu bloğu kütüphanene kaydetmek için Pro veya Custom pakete geçmen gerekiyor. Yükselttiğinde beğendiğin her blok tek tıkla tekrar kullanılabilir olur."
                  : "Saving this block to your library needs the Pro or Custom plan. Once you upgrade, every block you like becomes reusable in one click."}
              </p>
              <div className="flex justify-end pt-1">
                <Button size="sm" onClick={() => setShowLibraryUpsell(false)}>
                  {lang === "tr" ? "Anladım" : "Got it"}
                </Button>
              </div>
            </div>
          </div>
        )}
        {showCloseConfirm && (
          <div className="absolute inset-0 z-20 flex items-center justify-center rounded-2xl bg-black/40 p-6">
            <div className="w-full max-w-sm space-y-3 rounded-xl border border-border bg-card p-5 shadow-pop">
              <p className="text-sm font-medium">
                {lang === "tr" ? "Bu teklifi taslak olarak kaydetmek ister misin?" : "Save this proposal as a draft?"}
              </p>
              <p className="text-xs text-muted-foreground">
                {lang === "tr"
                  ? "Kaydedersen Teklifler listesinde \"Taslak\" olarak görünür, dilediğin zaman kaldığın yerden devam edebilirsin."
                  : "If you save it, it'll show up in Proposals as a \"Draft\" — you can pick up where you left off any time."}
              </p>
              {error && <p className="text-xs text-destructive">{error}</p>}
              <div className="flex justify-end gap-2 pt-1">
                <Button variant="outline" size="sm" onClick={confirmCloseWithoutSaving} disabled={loading}>
                  {lang === "tr" ? "Hayır, kaydetme" : "No, discard"}
                </Button>
                <Button size="sm" onClick={confirmCloseAndSave} disabled={loading}>
                  {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  {lang === "tr" ? "Evet, kaydet" : "Yes, save"}
                </Button>
              </div>
            </div>
          </div>
        )}
        <div className="flex items-center justify-between border-b border-border/70 bg-gradient-to-r from-primary/[0.06] via-transparent to-transparent px-6 py-4">
          <div className="flex items-center gap-2.5">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-[image:var(--grad-brand)] text-primary-foreground shadow-sm">
              <Sparkles className="h-4 w-4" />
            </span>
            <div>
              <h3 className="font-display text-base font-semibold leading-tight">
                {onboardingPending
                  ? lang === "tr" ? "Kurulum" : "Setup"
                  : mode === "template"
                    ? lang === "tr" ? "AI ile şablon yaz" : "Draft a template with AI"
                    : lang === "tr" ? "AI ile teklif yaz" : "Draft with AI"}
              </h3>
              {!onboardingPending && (
                <p className="text-[11px] text-muted-foreground">
                  {lang === "tr" ? "Seely — birkaç saniyede taslak hazırlar" : "Seely — drafts in seconds"}
                </p>
              )}
            </div>
          </div>
          <button onClick={requestClose} className="rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Mobile-only Chat/Preview tabs — the split view below is side-by-side
           from md: up, so this toggle only matters on small screens. */}
        <div className="flex shrink-0 border-b border-border md:hidden">
          <button
            type="button"
            onClick={() => setMobilePanel("chat")}
            className={cn(
              "flex-1 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors",
              mobilePanel === "chat" ? "border-primary text-primary" : "border-transparent text-muted-foreground",
            )}
          >
            {lang === "tr" ? "Sohbet" : "Chat"}
          </button>
          <button
            type="button"
            onClick={() => setMobilePanel("preview")}
            className={cn(
              "flex-1 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors",
              mobilePanel === "preview" ? "border-primary text-primary" : "border-transparent text-muted-foreground",
            )}
          >
            {lang === "tr" ? "Önizleme" : "Preview"}
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <div
          className={cn(
            "flex min-h-0 flex-col bg-card md:w-[30%] md:min-w-[340px] md:max-w-[460px] md:flex-none md:border-r md:border-border",
            mobilePanel === "preview" && "hidden md:flex",
          )}
        >
        <div className="flex-1 space-y-3 overflow-y-auto p-5">
          {messages.length === 0 && !onboardingPending && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <p className="font-display text-lg font-semibold leading-snug">
                  {lang === "tr" ? "Bugün ne hazırlayalım?" : "What should we draft today?"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {lang === "tr"
                    ? "Bir komut yaz, bir örneği seç ya da doğrudan dosya sürükle."
                    : "Type a command, pick an example, or just drop a file in."}
                </p>
              </div>

              {mode === "proposal" && !initialTemplateId && !resumeProposalId && (
                <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  {SECTOR_CHIPS.map((chip) => (
                    <button
                      key={chip.tr}
                      type="button"
                      onClick={() => setActiveTemplateId(chip.templateId)}
                      className={cn(
                        "shrink-0 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                        activeTemplateId === chip.templateId
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border/70 bg-muted/30 text-muted-foreground hover:bg-muted",
                      )}
                    >
                      {chip.emoji} {lang === "tr" ? chip.tr : chip.en}
                    </button>
                  ))}
                </div>
              )}

              <div className="grid grid-cols-1 gap-1.5">
                {(lang === "tr"
                  ? [
                      "ABC Lojistik için operasyonel dönüşüm danışmanlığı teklifi hazırla, 3 aylık proje, toplam 45.000$ civarı.",
                      "Yeni bir web sitesi projesi için 15.000$'lık bir yazılım teklifi yaz.",
                      "Ofis tadilatı için malzeme + işçilik dahil kapsamlı bir teklif oluştur.",
                    ]
                  : [
                      "Draft an operational transformation consulting proposal for ABC Logistics, 3-month project, around $45,000 total.",
                      "Write a $15,000 software proposal for a new website project.",
                      "Create a comprehensive office renovation proposal including materials and labor.",
                    ]
                ).map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => send(prompt)}
                    className="group flex items-start gap-2 rounded-xl border border-border/70 bg-muted/20 px-3.5 py-2.5 text-left text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary/5 hover:text-foreground"
                  >
                    <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary/60 transition-colors group-hover:text-primary" />
                    <span>{prompt}</span>
                  </button>
                ))}
              </div>

              {!showChecklist ? (
                <button
                  onClick={() => setShowChecklist(true)}
                  className="text-xs font-medium text-primary hover:underline"
                >
                  {lang === "tr" ? "Kapsamlı teklif için bölümleri seç →" : "Pick sections for a comprehensive proposal →"}
                </button>
              ) : (
                <div className="rounded-xl border border-border bg-muted/30 p-3.5">
                  <div className="mb-2 flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setShowChecklist(false)}
                      className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                      aria-label={lang === "tr" ? "Geri" : "Back"}
                    >
                      <ArrowLeft className="h-3.5 w-3.5" />
                    </button>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {lang === "tr" ? "Teklife hangi bölümler dahil olsun?" : "Which sections should the proposal include?"}
                    </p>
                  </div>
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


          {clarify && !loading && (
            <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-border bg-muted/30 p-3">
              <span className="w-full text-xs text-muted-foreground">
                {lang === "tr" ? clarify.question.tr : clarify.question.en}
              </span>
              {clarify.chips.map((chip) => {
                const selected = clarifySelection.includes(chip.key);
                return (
                  <button
                    key={chip.key}
                    type="button"
                    onClick={() => {
                      const label = lang === "tr" ? chip.label.tr : chip.label.en;
                      if (clarify.multiSelect) {
                        setClarifySelection((prev) => (prev.includes(chip.key) ? prev.filter((k) => k !== chip.key) : [...prev, chip.key]));
                        setInput((prev) => {
                          const labels = new Set(prev.split(",").map((s) => s.trim()).filter(Boolean));
                          if (labels.has(label)) labels.delete(label);
                          else labels.add(label);
                          return [...labels].join(", ");
                        });
                      } else {
                        setClarify(null);
                        setClarifySelection([]);
                        send(label);
                      }
                    }}
                    className={cn(
                      "shrink-0 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                      selected ? "border-primary bg-primary/10 text-primary" : "border-border bg-card text-muted-foreground hover:bg-muted",
                    )}
                  >
                    {lang === "tr" ? chip.label.tr : chip.label.en}
                  </button>
                );
              })}
              {clarify.multiSelect && (
                <Button
                  size="sm"
                  className="ml-auto h-7 px-3 text-xs"
                  onClick={() => {
                    setClarify(null);
                    send();
                  }}
                >
                  {lang === "tr" ? "Devam et" : "Continue"}
                </Button>
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

        <div className="space-y-2 border-t border-border/70 bg-muted/10 p-4">
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
            {voiceError && <p className="text-xs text-destructive">{voiceError}</p>}
            {showWebsiteField && (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setShowWebsiteField(false);
                    setWebsiteUrl("");
                  }}
                  className="shrink-0 rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                  aria-label={lang === "tr" ? "Geri" : "Back"}
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                </button>
                <Input
                  value={websiteUrl}
                  onChange={(e) => setWebsiteUrl(e.target.value)}
                  placeholder={lang === "tr" ? "https://musteri-sitesi.com/iletisim" : "https://client-site.com/contact"}
                  className="h-8 text-xs"
                  autoFocus
                />
              </div>
            )}

            {/* Command bar — full-width composer with inline actions on both ends. */}
            <div
              className={cn(
                "flex items-end gap-2 rounded-2xl border border-input bg-card px-2 py-2 shadow-sm transition-colors focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/40",
                loading && "opacity-70",
              )}
            >
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
                className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted disabled:opacity-50"
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
                rows={1}
                className="flex max-h-32 min-h-9 w-full resize-none bg-transparent px-1 py-1.5 text-sm text-foreground placeholder:text-muted-foreground/70 focus-visible:outline-none disabled:cursor-not-allowed"
              />
              {planAllows(plan, "voice_input") && speechSupported && (
                <button
                  onClick={toggleRecording}
                  disabled={loading}
                  title={
                    recording
                      ? lang === "tr"
                        ? "Kaydı durdur"
                        : "Stop recording"
                      : lang === "tr"
                        ? "Sesli mesaj: 'Ali Bey'e 10 bin liralık sosyal medya danışmanlığı teklifi hazırla' de"
                        : "Voice input: say what proposal to draft"
                  }
                  className={cn(
                    "grid h-9 w-9 shrink-0 place-items-center rounded-full transition-colors disabled:opacity-50",
                    recording
                      ? "animate-pulse bg-destructive/10 text-destructive"
                      : "text-muted-foreground hover:bg-muted",
                  )}
                >
                  {recording ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                </button>
              )}
              <Button
                size="icon"
                className="h-9 w-9 shrink-0 rounded-full"
                onClick={loading ? stopGeneration : () => send()}
                disabled={false}
                title={loading ? (lang === "tr" ? "Durdur (Esc)" : "Stop (Esc)") : undefined}
              >
                {loading ? <X className="h-4 w-4" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>

            {/* Secondary utility row — recent templates + optional client link, kept
               out of the way of the composer itself. */}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-1">
              {!showWebsiteField && (
                <button
                  onClick={() => setShowWebsiteField(true)}
                  className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-primary"
                >
                  <Link2 className="h-3 w-3" />
                  {lang === "tr" ? "Müşteri linki ekle" : "Add client link"}
                </button>
              )}
              {recentTemplates.length > 0 && messages.length === 0 && (
                <>
                  <span className="text-[11px] text-muted-foreground/50">•</span>
                  <div className="flex min-w-0 items-center gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    <span className="shrink-0 text-[11px] text-muted-foreground">
                      {lang === "tr" ? "Son kullanılan:" : "Recent:"}
                    </span>
                    {recentTemplates.map((t) => (
                      <button
                        key={t.id}
                        onClick={() => useRecentTemplate(t.id, t.name)}
                        disabled={loading}
                        className="shrink-0 rounded-full border border-border/70 bg-muted/30 px-2 py-0.5 text-[11px] font-medium hover:bg-muted disabled:opacity-50"
                      >
                        {t.name}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
        </div>
        </div>

        <div
          className={cn(
            "relative min-h-0 flex-col overflow-y-auto bg-[radial-gradient(circle_at_1px_1px,theme(colors.border/60)_1px,transparent_0)] [background-size:22px_22px] md:flex md:w-[70%] md:flex-1",
            mobilePanel === "chat" ? "hidden md:flex" : "flex",
          )}
        >
          {/* Floating "Seely is writing" indicator — the canvas equivalent of a live cursor. */}
          {canvasTyping && (
            <div className="pointer-events-none sticky top-4 z-30 mx-auto flex w-fit items-center gap-1.5 self-center rounded-full border border-primary/30 bg-card/95 px-3 py-1.5 text-[11px] font-medium text-primary shadow-pop backdrop-blur animate-in fade-in slide-in-from-top-2">
              <PenLine className="h-3.5 w-3.5 animate-pulse" />
              {lang === "tr" ? "Seely canlı olarak yazıyor…" : "Seely is writing live…"}
            </div>
          )}

          {draft && (() => {
            const theme = draft.themeJson;
            const primary = theme?.primaryColor || "#0b2545";
            const accent = theme?.accentColor || "#8a6d3b";
            const typing = canvasTyping;
            return (
            <div className="mx-auto w-full max-w-3xl px-4 pb-24 pt-8 md:px-8">
            <div className="overflow-hidden rounded-2xl border border-border/70 bg-white shadow-[0_30px_80px_-30px_rgba(0,0,0,0.35)]">
              {/* ── Magazine cover: color block + photo panel + typed title ── */}
              <div className="relative grid grid-cols-5 overflow-hidden" style={{ background: primary }}>
                <div className="col-span-3 flex flex-col justify-between p-8 text-white/95 sm:p-10">
                  <div className="flex items-start justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-white/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider">
                      <Sparkles className="h-3 w-3" />
                      {lang === "tr" ? "Teklif" : "Proposal"}
                    </span>
                    {mode === "proposal" && !showSaveTemplateField && !templateSaved && (
                      <button
                        type="button"
                        onClick={() => {
                          setTemplateSaveName(draft.title);
                          setShowSaveTemplateField(true);
                        }}
                        className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-white/25 bg-white/10 px-2 py-1 text-[11px] font-medium text-white/90 hover:bg-white/20"
                      >
                        <BookmarkPlus className="h-3.5 w-3.5" />
                        {lang === "tr" ? "Taslak olarak kaydet" : "Save as template"}
                      </button>
                    )}
                    {mode === "proposal" && templateSaved && (
                      <span className="inline-flex shrink-0 items-center gap-1 text-[11px] font-medium text-white">
                        <Check className="h-3.5 w-3.5" />
                        {lang === "tr" ? "Kaydedildi" : "Saved"}
                      </span>
                    )}
                  </div>
                  <div className="space-y-2 pt-10">
                    {typing ? (
                      <h1 className="font-display text-3xl font-semibold leading-tight sm:text-4xl">
                        <TypeReveal text={draft.title} typing={typing} revealKey={`title-${draftGen}`} />
                      </h1>
                    ) : (
                      <Editable
                        as="h1"
                        value={draft.title}
                        onChange={(v) => setDraft((d) => (d ? { ...d, title: v } : d))}
                        className="font-display text-3xl font-semibold leading-tight sm:text-4xl"
                        placeholder={lang === "tr" ? "Teklif başlığı" : "Proposal title"}
                      />
                    )}
                    {mode !== "template" && (
                      <p className="text-sm font-medium text-white/70">
                        {lang === "tr" ? "Hazırlanan:" : "Prepared for:"}{" "}
                        <TypeReveal text={draft.client} typing={typing} revealKey={`client-${draftGen}`} speed={22} />
                      </p>
                    )}
                  </div>
                </div>
                <PhotoBlock seed={draft.title + "cover"} color={accent} className="col-span-2" />
              </div>

              <div className="space-y-8 p-8 sm:p-10">
              {(() => {
                // Prefer draft.blocks when it's already been populated (e.g. by the
                // add_legal_block_to_proposal tool — see app/api/draft-proposal/route.ts) so
                // Legal blocks show up here too; legacyToBlocks alone has no idea they exist.
                const blocks =
                  draft.blocks && draft.blocks.length > 0
                    ? draft.blocks
                    : legacyToBlocks({
                        sections: draft.sections,
                        lineItems: draft.lineItems,
                        contractText: draft.contractText,
                      });
                const blockLabel = (b: (typeof blocks)[number]) =>
                  b.type === "HeroCover"
                    ? lang === "tr" ? "Kapak" : "Cover"
                    : b.type === "PricingTable"
                      ? lang === "tr" ? "Fiyatlandırma" : "Pricing"
                      : b.type === "ContractSignOff"
                        ? lang === "tr" ? "Sözleşme / İmza" : "Contract / Sign"
                        : b.type === "Legal"
                          ? b.title
                          : b.label;
                return (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {lang === "tr" ? `${blocks.length} blok eklendi` : `${blocks.length} blocks added`}
                    </p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {blocks.map((b, i) => (
                        <span
                          key={b.id}
                          className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-2 py-0.5 text-[11px] font-medium text-muted-foreground"
                        >
                          <span className="tnum text-[9px] text-muted-foreground/70">{String(i + 1).padStart(2, "0")}</span>
                          {blockLabel(b)}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })()}
              {draft.blocks && draft.blocks.some((b) => b.type === "Legal" || b.type === "ContractSignOff") && (
                <BlockRenderer
                  blocks={draft.blocks.filter((b) => b.type === "Legal" || b.type === "ContractSignOff")}
                  ctx={{
                    title: draft.title,
                    client: draft.client,
                    value: draft.value,
                    lineItems: [],
                    lang,
                    editable: true,
                    onLegalBlockChange: (blockId, patch) =>
                      setDraft((prev) => {
                        if (!prev?.blocks) return prev;
                        return {
                          ...prev,
                          blocks: prev.blocks.map((b) =>
                            b.id === blockId && b.type === "Legal" ? { ...b, ...patch, settings: { requireSignature: patch.requireSignature } } : b,
                          ),
                        };
                      }),
                    getCompanySignState,
                    onSaveToLibrary: saveBlockToLibrary,
                    savingLibraryBlockId,
                    savedLibraryBlockIds,
                  }}
                />
              )}
              {mode === "proposal" && showSaveTemplateField && (
                <div className="flex items-center gap-1.5">
                  <Input
                    value={templateSaveName}
                    onChange={(e) => setTemplateSaveName(e.target.value)}
                    placeholder={lang === "tr" ? "Taslak adı" : "Template name"}
                    className="h-8 flex-1 text-xs"
                  />
                  <Button size="sm" className="h-8 gap-1 px-2.5 text-xs" onClick={saveAsTemplate} disabled={savingTemplate}>
                    {savingTemplate ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                    {lang === "tr" ? "Onayla" : "Confirm"}
                  </Button>
                  <button
                    type="button"
                    onClick={() => setShowSaveTemplateField(false)}
                    className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
              {mode !== "template" && (
                <div className="flex items-center justify-end">
                  <div className="inline-flex rounded-lg border border-border bg-muted/30 p-0.5 text-xs">
                    {(["pages", "scroll"] as const).map((mode2) => (
                      <button
                        key={mode2}
                        type="button"
                        onClick={() => setDraft((d) => (d ? { ...d, viewMode: mode2 } : d))}
                        className={cn(
                          "rounded-md px-2.5 py-1 font-medium transition-colors",
                          (draft.viewMode ?? "pages") === mode2
                            ? "bg-primary text-primary-foreground"
                            : "text-muted-foreground hover:text-foreground",
                        )}
                      >
                        {mode2 === "pages"
                          ? lang === "tr" ? "Sayfa geçişli" : "Paginated"
                          : lang === "tr" ? "Tek sayfa (kaydırmalı)" : "Single scroll"}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {/* Magazine-style content sections — alternating text/photo blocks,
                 each editable in place once Seely's done writing it. */}
              {draft.sections?.map((s, i) => (
                <div
                  key={i}
                  className={cn(
                    "grid items-stretch gap-0 overflow-hidden rounded-xl border border-border/70",
                    i % 2 === 0 ? "grid-cols-1 sm:grid-cols-5" : "grid-cols-1 sm:grid-cols-5",
                  )}
                >
                  <div
                    className={cn(
                      "flex flex-col justify-center gap-2 p-6 sm:p-7",
                      i % 2 === 0 ? "sm:order-1 sm:col-span-3" : "sm:order-2 sm:col-span-3",
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[10px] font-bold uppercase tracking-[0.14em]" style={{ color: accent }}>
                        <TypeReveal text={s.title} typing={typing} revealKey={`sec-t-${i}-${draftGen}`} speed={20} />
                      </p>
                      <button
                        type="button"
                        onClick={() => saveSectionToLibrary(i, s.title, s.body)}
                        disabled={savingSectionIndex === i || savedSectionIndexes[i]}
                        title={lang === "tr" ? "Kütüphaneme ekle" : "Add to my library"}
                        className={cn(
                          "shrink-0 rounded-md p-1 transition-colors",
                          savedSectionIndexes[i] ? "text-success" : "text-muted-foreground hover:text-primary",
                        )}
                      >
                        {savingSectionIndex === i ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : savedSectionIndexes[i] ? (
                          <Check className="h-3.5 w-3.5" />
                        ) : (
                          <BookmarkPlus className="h-3.5 w-3.5" />
                        )}
                      </button>
                    </div>
                    <Editable
                      as="h3"
                      value={s.title}
                      disabled={typing}
                      onChange={(v) =>
                        setDraft((d) => (d ? { ...d, sections: d.sections.map((x, j) => (j === i ? { ...x, title: v } : x)) } : d))
                      }
                      className="font-display text-xl font-semibold text-foreground"
                      placeholder={lang === "tr" ? "Bölüm başlığı" : "Section title"}
                    />
                    {typing ? (
                      <p className="text-sm leading-relaxed text-muted-foreground">
                        <TypeReveal text={s.body} typing={typing} revealKey={`sec-b-${i}-${draftGen}`} speed={6} />
                      </p>
                    ) : (
                      <Editable
                        as="p"
                        value={s.body}
                        onChange={(v) =>
                          setDraft((d) => (d ? { ...d, sections: d.sections.map((x, j) => (j === i ? { ...x, body: v } : x)) } : d))
                        }
                        className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground"
                        placeholder={lang === "tr" ? "Bölüm metni…" : "Section text…"}
                      />
                    )}
                    {s.videoUrl && <p className="truncate text-xs text-muted-foreground">🎬 {s.videoUrl}</p>}
                  </div>
                  <PhotoBlock
                    seed={s.title + i}
                    color={i % 3 === 0 ? accent : undefined}
                    className={cn("min-h-[140px] sm:col-span-2", i % 2 === 0 ? "sm:order-2" : "sm:order-1")}
                  />
                </div>
              ))}
              {draft.lineItems?.length > 0 && (
                <div className="overflow-hidden rounded-xl border border-border/70">
                  <div className="px-5 py-3 text-white" style={{ background: primary }}>
                    <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/80">
                      {lang === "tr" ? "Yatırım" : "Investment"}
                    </p>
                    <p className="font-display text-lg font-semibold">
                      ${draft.value.toLocaleString()}
                    </p>
                  </div>
                  <table className="w-full text-sm">
                    <tbody>
                      {draft.lineItems.map((li, i) => (
                        <tr key={i} className="border-t border-border/60">
                          <td className="px-5 py-2.5">
                            {li.name} × {li.qty}
                            {li.optional && (
                              <span className="ml-1.5 text-[10px] text-muted-foreground">
                                ({lang === "tr" ? "opsiyonel" : "optional"})
                              </span>
                            )}
                          </td>
                          <td className="px-5 py-2.5 text-right tnum">${(li.unit * li.qty).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
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
                      {o.paymentLink && (
                        <p className="truncate text-xs text-muted-foreground">💳 {o.paymentLink}</p>
                      )}
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
              {(!draft.billingOptions || draft.billingOptions.length === 0) && paymentLink && (
                <div>
                  <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    <CreditCard className="h-3.5 w-3.5" />
                    {lang === "tr" ? "Ödeme Yöntemi" : "Payment Method"}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">{paymentLink}</p>
                </div>
              )}
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
            </div>
            </div>
            );
          })()}

          {!draft && sending && (
            <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-4 px-4 py-8 md:px-8">
              <div className="overflow-hidden rounded-2xl border border-border/70 bg-white shadow-[0_30px_80px_-30px_rgba(0,0,0,0.35)]">
                <div className="grid grid-cols-5 animate-pulse gap-0" style={{ background: "linear-gradient(135deg,#0b2545,#1c3a63)" }}>
                  <div className="col-span-3 space-y-3 p-8">
                    <div className="h-4 w-24 rounded-full bg-white/15" />
                    <div className="h-8 w-4/5 rounded-md bg-white/20" />
                    <div className="h-3 w-1/2 rounded bg-white/15" />
                  </div>
                  <div className="col-span-2 bg-white/10" />
                </div>
                <div className="animate-pulse space-y-4 p-8">
                  <div className="space-y-2">
                    <div className="h-3 w-full rounded bg-muted" />
                    <div className="h-3 w-11/12 rounded bg-muted" />
                    <div className="h-3 w-3/5 rounded bg-muted" />
                  </div>
                  <div className="space-y-2 pt-1">
                    <div className="h-3 w-1/3 rounded bg-muted" />
                    <div className="flex items-center justify-between rounded-lg border border-border/50 px-3 py-2">
                      <div className="h-3 w-1/2 rounded bg-muted" />
                      <div className="h-3 w-10 rounded bg-muted" />
                    </div>
                    <div className="flex items-center justify-between rounded-lg border border-border/50 px-3 py-2">
                      <div className="h-3 w-2/5 rounded bg-muted" />
                      <div className="h-3 w-10 rounded bg-muted" />
                    </div>
                  </div>
                </div>
              </div>
              <p className="flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
                <PenLine className="h-3.5 w-3.5 animate-pulse text-primary" />
                {lang === "tr" ? "Seely taslağı hazırlıyor…" : "Seely is preparing the draft…"}
              </p>
            </div>
          )}

          {!draft && !sending && (
            <div className="mx-auto w-full max-w-3xl px-4 pb-24 pt-8 md:px-8">
              <div className="overflow-hidden rounded-2xl border border-border/70 bg-white shadow-[0_30px_80px_-30px_rgba(0,0,0,0.35)]">
                {/* Blank document shell — a cover band + skeleton copy so the canvas
                   reads as an empty A4 proposal waiting to be written, never as a
                   bare message box. */}
                <div
                  className="relative grid grid-cols-5 overflow-hidden"
                  style={{ background: "#0b2545" }}
                >
                  <div className="col-span-3 flex flex-col justify-between p-8 text-white/95 sm:p-10">
                    <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-white/25 bg-white/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider">
                      <Sparkles className="h-3 w-3" />
                      {lang === "tr" ? "Teklif" : "Proposal"}
                    </span>
                    <div className="space-y-2 pt-10">
                      <div className="h-8 w-2/3 rounded bg-white/15" />
                      <div className="h-3.5 w-1/3 rounded bg-white/10" />
                    </div>
                  </div>
                  <PhotoBlock seed="empty-cover" className="col-span-2" />
                </div>
                <div className="space-y-6 p-8 sm:p-10">
                  <div className="space-y-2.5">
                    <div className="h-3.5 w-1/4 rounded bg-muted" />
                    <div className="h-3 w-full rounded bg-muted/70" />
                    <div className="h-3 w-5/6 rounded bg-muted/70" />
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    {[0, 1, 2].map((i) => (
                      <div key={i} className="space-y-2 rounded-xl border border-border/60 p-3">
                        <div className="h-3 w-1/2 rounded bg-muted" />
                        <div className="h-6 w-2/3 rounded bg-muted/70" />
                      </div>
                    ))}
                  </div>
                  <p className="flex items-center justify-center gap-1.5 pt-2 text-center text-xs text-muted-foreground">
                    <Sparkles className="h-3.5 w-3.5 text-primary/60" />
                    {lang === "tr"
                      ? "Sol taraftan bir komut gönder, Seely taslağı saniyeler içinde bu dokümanın üzerine canlı olarak yazsın."
                      : "Send a command on the left and Seely will write the draft live onto this document in seconds."}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
