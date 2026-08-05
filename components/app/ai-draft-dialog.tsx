"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { Sparkles, X, Send, Loader2, Check, Link2, CreditCard, Paperclip, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLang } from "@/components/i18n/language-provider";
import { cn } from "@/lib/utils";

type Msg = { role: "user" | "assistant"; content: string; attachmentName?: string };
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
};

/** Renders "**bold**" markdown segments as real <strong> text instead of literal asterisks. */
function renderFormatted(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i} className="font-semibold">{part.slice(2, -2)}</strong>;
    }
    return <span key={i}>{part}</span>;
  });
}

export function AiDraftDialog({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
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
  const [attachment, setAttachment] = useState<Attachment | null>(null);
  const [attachError, setAttachError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
  const ACCEPTED_TYPES = ["application/pdf", "image/png", "image/jpeg", "image/webp", "image/gif"];

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

  function processFile(file: File) {
    setAttachError(null);

    if (!ACCEPTED_TYPES.includes(file.type)) {
      setAttachError(lang === "tr" ? "Sadece PDF veya resim (PNG/JPG) ekleyebilirsin." : "Only PDF or image files (PNG/JPG) are supported.");
      return;
    }
    if (file.size > MAX_ATTACHMENT_BYTES) {
      setAttachError(lang === "tr" ? "Dosya en fazla 10MB olabilir." : "File must be under 10MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(",")[1] ?? "";
      setAttachment({ name: file.name, mediaType: file.type, base64 });
    };
    reader.readAsDataURL(file);
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    processFile(file);
  }

  function handleDragOver(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    if (e.dataTransfer.types.includes("Files")) setDragOver(true);
  }

  function handleDragLeave(e: React.DragEvent<HTMLDivElement>) {
    if (e.currentTarget === e.target) setDragOver(false);
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  }

  function handlePaste(e: React.ClipboardEvent<HTMLTextAreaElement>) {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.kind === "file" && item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (file) {
          e.preventDefault();
          processFile(file);
        }
        return;
      }
    }
  }

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, draft]);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!open || !mounted) return null;

  /** Matches a bare "save it" message ("kaydet", "teklife ekle", "save") — nothing else in the sentence, so it doesn't misfire on "kaydettim ama..." or similar. */
  function isSaveIntent(text: string) {
    return /^(kaydet(?:sene)?|kaydediver|teklife ekle|ekle|save( it| this)?)[.!?]*$/i.test(text.trim());
  }

  async function send(override?: string) {
    if ((!override?.trim() && !input.trim() && !attachment) || loading) return;
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

    const next = [...messages, { role: "user" as const, content: text, attachmentName: attachment?.name }];
    setMessages(next);
    setInput("");
    const sentAttachment = attachment;
    setAttachment(null);
    setLoading(true);
    setSending(true);
    setError(null);
    setOverage(null);

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 130_000);

    try {
      const res = await fetch("/api/draft-proposal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: next.map(({ role, content }) => ({ role, content })),
          websiteUrl: websiteUrl || undefined,
          attachment: sentAttachment ?? undefined,
        }),
        signal: controller.signal,
      });
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
      setMessages((m) => [...m, { role: "assistant", content: reply }]);
      if (data.draft) {
        setDraft(data.draft);
        // The model only sets this after the user explicitly confirmed the final
        // proposal in chat — save it immediately instead of waiting for a manual click.
        if (data.draft.confirmed) saveDraft(data.draft);
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
        if (data.brand.setLogo && sentAttachment?.mediaType.startsWith("image/")) {
          fetch("/api/settings/logo", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ mediaType: sentAttachment.mediaType, base64: sentAttachment.base64 }),
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
      }
    } catch (err) {
      setError(
        err instanceof DOMException && err.name === "AbortError"
          ? lang === "tr"
            ? "Yanıt çok uzun sürdü, lütfen tekrar dene."
            : "That took too long — please try again."
          : lang === "tr"
            ? "Bağlantı hatası."
            : "Connection error.",
      );
    } finally {
      window.clearTimeout(timeoutId);
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
      const res = await fetch(savedProposalId ? `/api/proposals/${savedProposalId}` : "/api/proposals", {
        method: savedProposalId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...toSave, paymentLink: paymentLink.trim() || undefined }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error || (lang === "tr" ? "Teklif kaydedilemedi." : "Couldn't save the proposal."));
        return;
      }
      if (!savedProposalId && data?.id) setSavedProposalId(data.id);
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
    setAttachment(null);
    setAttachError(null);
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
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
            <h3 className="font-semibold">{lang === "tr" ? "AI ile teklif yaz" : "Draft with AI"}</h3>
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
          {messages.length === 0 && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {lang === "tr"
                  ? "Örn: \"Acme için web sitesi tasarımı teklifi hazırla, Growth paketiyle.\" Eksik bir şey olursa sana soracağım."
                  : "E.g. \"Draft a website design proposal for Acme, using the Growth package.\" I'll ask if anything's missing."}
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
          {messages.map((m, i) => (
            <div
              key={i}
              className={cn(
                "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm",
                m.role === "user" ? "ml-auto bg-primary text-primary-foreground" : "bg-muted text-foreground",
              )}
            >
              {m.attachmentName && (
                <p className={cn("mb-1 flex items-center gap-1 text-xs", m.role === "user" ? "text-primary-foreground/80" : "text-muted-foreground")}>
                  <FileText className="h-3 w-3" />
                  {m.attachmentName}
                </p>
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
              <p className="text-sm text-muted-foreground">{draft.client}</p>
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
                {savedProposalId
                  ? lang === "tr" ? "Değişiklikleri kaydet" : "Save changes"
                  : lang === "tr" ? "Teklife ekle" : "Add to proposals"}
              </Button>
              {savedProposalId && (
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
                placeholder="https://musteri-sitesi.com"
                className="text-sm"
              />
            ) : (
              <button
                onClick={() => setShowWebsiteField(true)}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary"
              >
                <Link2 className="h-3.5 w-3.5" />
                {lang === "tr" ? "Müşterinin web sitesini paylaş (opsiyonel)" : "Share client's website (optional)"}
              </button>
            )}
            {attachment && (
              <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-2.5 py-1.5 text-xs">
                <FileText className="h-3.5 w-3.5 shrink-0 text-primary" />
                <span className="min-w-0 flex-1 truncate">{attachment.name}</span>
                <button onClick={() => setAttachment(null)} className="shrink-0 text-muted-foreground hover:text-destructive">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
            {attachError && <p className="text-xs text-destructive">{attachError}</p>}
            <div className="flex items-end gap-2">
              <input ref={fileInputRef} type="file" accept="application/pdf,image/png,image/jpeg,image/webp,image/gif" onChange={handleFileSelect} className="hidden" />
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
                      ? "Seely yazıyor…"
                      : "Seely is typing…"
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
              <Button size="icon" onClick={() => send()} disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
