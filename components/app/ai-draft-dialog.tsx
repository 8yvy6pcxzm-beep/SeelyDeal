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
type BillingOption = { key: string; label: { tr: string; en: string }; price: number };
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
  const [draft, setDraft] = useState<Draft | null>(null);
  const [paymentLink, setPaymentLink] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [overage, setOverage] = useState<{ link: string | null; price: number; drafts: number } | null>(null);
  const [saved, setSaved] = useState(false);
  const [attachment, setAttachment] = useState<Attachment | null>(null);
  const [attachError, setAttachError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
  const ACCEPTED_TYPES = ["application/pdf", "image/png", "image/jpeg", "image/webp", "image/gif"];

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
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

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, draft]);

  if (!open) return null;

  async function send() {
    if ((!input.trim() && !attachment) || loading) return;
    const text = input.trim() || (lang === "tr" ? "Ektesindeki dokümanı incele ve teklif için kullan." : "Review the attached document and use it for the proposal.");
    const next = [...messages, { role: "user" as const, content: text, attachmentName: attachment?.name }];
    setMessages(next);
    setInput("");
    const sentAttachment = attachment;
    setAttachment(null);
    setLoading(true);
    setError(null);
    setOverage(null);

    try {
      const res = await fetch("/api/draft-proposal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: next.map(({ role, content }) => ({ role, content })),
          websiteUrl: websiteUrl || undefined,
          attachment: sentAttachment ?? undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Bir şeyler ters gitti.");
        if (res.status === 429) {
          setOverage({ link: data.overageLink ?? null, price: data.overagePrice, drafts: data.overageDrafts });
        }
        setLoading(false);
        return;
      }
      setMessages((m) => [...m, { role: "assistant", content: data.reply }]);
      if (data.draft) setDraft(data.draft);
    } catch {
      setError(lang === "tr" ? "Bağlantı hatası." : "Connection error.");
    } finally {
      setLoading(false);
    }
  }

  async function saveDraft() {
    if (!draft) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/proposals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...draft, paymentLink: paymentLink.trim() || undefined }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error || (lang === "tr" ? "Teklif kaydedilemedi." : "Couldn't save the proposal."));
        return;
      }
      setSaved(true);
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
    setSaved(false);
    setError(null);
    setOverage(null);
    setWebsiteUrl("");
    setShowWebsiteField(false);
    setAttachment(null);
    setAttachError(null);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-pop"
        onClick={(e) => e.stopPropagation()}
      >
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
            <p className="text-sm text-muted-foreground">
              {lang === "tr"
                ? "Örn: \"Acme için web sitesi tasarımı teklifi hazırla, Growth paketiyle.\" Eksik bir şey olursa sana soracağım."
                : "E.g. \"Draft a website design proposal for Acme, using the Growth package.\" I'll ask if anything's missing."}
            </p>
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
              {m.content}
            </div>
          ))}

          {draft && !saved && (
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
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {lang === "tr" ? "Ödeme sıklığı seçenekleri" : "Billing options"}
                  </p>
                  <div className="mt-1 flex gap-2">
                    {draft.billingOptions.map((o) => (
                      <span key={o.key} className="rounded-lg border border-border px-2.5 py-1 text-xs">
                        {lang === "tr" ? o.label.tr : o.label.en} — ${o.price.toLocaleString()}
                      </span>
                    ))}
                  </div>
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
              <Button onClick={saveDraft} disabled={loading} className="w-full gap-2">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                {lang === "tr" ? "Teklife ekle" : "Add to proposals"}
              </Button>
            </div>
          )}

          {saved && (
            <div className="rounded-xl border border-success/30 bg-success/10 p-4 text-center text-sm text-success">
              {lang === "tr" ? "Teklif kaydedildi." : "Proposal saved."}
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

        {!saved && (
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
                placeholder={lang === "tr" ? "Mesajını yaz… (yeni satır için Shift+Enter)" : "Type a message… (Shift+Enter for a new line)"}
                disabled={loading}
                rows={3}
                className="flex w-full resize-none rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-ring transition-colors disabled:opacity-50"
              />
              <Button size="icon" onClick={send} disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
