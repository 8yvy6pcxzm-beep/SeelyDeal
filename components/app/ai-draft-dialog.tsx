"use client";

import { useState, useRef, useEffect } from "react";
import { Sparkles, X, Send, Loader2, Check, Link2, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLang } from "@/components/i18n/language-provider";
import { cn } from "@/lib/utils";

type Msg = { role: "user" | "assistant"; content: string };
type Draft = {
  title: string;
  client: string;
  value: number;
  sections: { title: string; body: string }[];
  lineItems: { name: string; qty: number; unit: number }[];
  contractText?: string;
};

export function AiDraftDialog({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
  const { lang } = useLang();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [showWebsiteField, setShowWebsiteField] = useState(false);
  const [loading, setLoading] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [paymentLink, setPaymentLink] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, draft]);

  if (!open) return null;

  async function send() {
    if (!input.trim() || loading) return;
    const next = [...messages, { role: "user" as const, content: input.trim() }];
    setMessages(next);
    setInput("");
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/draft-proposal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next, websiteUrl: websiteUrl || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Bir şeyler ters gitti.");
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
    const res = await fetch("/api/proposals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...draft, paymentLink: paymentLink.trim() || undefined }),
    });
    setLoading(false);
    if (res.ok) {
      setSaved(true);
      onSaved();
    }
  }

  function reset() {
    setMessages([]);
    setDraft(null);
    setPaymentLink("");
    setSaved(false);
    setError(null);
    setWebsiteUrl("");
    setShowWebsiteField(false);
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
                        </td>
                        <td className="py-1.5 text-right tnum">${(li.unit * li.qty).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
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

          {error && <p className="text-sm text-destructive">{error}</p>}
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
            <div className="flex items-center gap-2">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && send()}
                placeholder={lang === "tr" ? "Mesajını yaz…" : "Type a message…"}
                disabled={loading}
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
