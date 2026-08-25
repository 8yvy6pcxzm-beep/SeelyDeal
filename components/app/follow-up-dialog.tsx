"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X, Sparkles, Send, Loader2, Check } from "lucide-react";
import type { Lang } from "@/lib/i18n/config";
import { cn } from "@/lib/utils";

type FollowUpTarget = { id: string; number: string; client: string; title: string };

/** Opened from the dashboard's "AI ile Takip Et" nudge — composes one AI-drafted
 *  reminder message for every "viewed but not signed" proposal at once, lets the
 *  user tweak it, then fans it out to /api/proposals/[id]/remind via `onSend`.
 *  A chip per proposal doubles as a shortcut into that proposal's detail drawer
 *  (`onSelect`) without leaving this dialog open on top of it. */
export function FollowUpDialog({
  open,
  proposals,
  lang,
  onSelect,
  onSend,
  onClose,
}: {
  open: boolean;
  proposals: FollowUpTarget[];
  lang: Lang;
  onSelect: (id: string) => void;
  onSend: (ids: string[]) => Promise<void>;
  onClose: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setSent(false);
    setError(null);
    const names = Array.from(new Set(proposals.map((p) => p.client).filter(Boolean)));
    const nameList = names.length ? names.join(", ") : "";
    setMessage(
      lang === "tr"
        ? `Merhaba,\n\n${nameList ? `${nameList} için g` : "G"}önderdiğimiz teklif${proposals.length > 1 ? "ler" : ""} henüz imzalanmadı. Hazır olduğunuzda birlikte gözden geçirelim — aklınıza takılan bir şey olursa buradayım.\n\nİyi günler dilerim.`
        : `Hi,\n\nJust checking in on the proposal${proposals.length > 1 ? "s" : ""} we sent${nameList ? ` to ${nameList}` : ""} — happy to walk through anything before you sign.\n\nBest.`,
    );
  }, [open, proposals, lang]);

  if (!open || !mounted) return null;

  async function handleSend() {
    setSending(true);
    setError(null);
    try {
      await onSend(proposals.map((p) => p.id));
      setSent(true);
      window.setTimeout(onClose, 900);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSending(false);
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md overflow-hidden rounded-2xl border border-border bg-card shadow-pop"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h3 className="flex items-center gap-2 font-semibold">
            <Sparkles className="h-4 w-4 text-primary" />
            {lang === "tr" ? "AI ile takip mesajı" : "AI follow-up message"}
          </h3>
          <button onClick={onClose} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3 p-5">
          <div>
            <p className="label-mono pb-1.5 text-muted-foreground">
              {lang === "tr" ? "Alıcılar — birine tıkla, detayı gör" : "Recipients — click one to see its detail"}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {proposals.map((p) => (
                <button
                  key={p.id}
                  onClick={() => onSelect(p.id)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/40 px-2.5 py-1 text-[11.5px] font-medium transition-colors hover:bg-muted"
                >
                  <span className="tnum">{p.number}</span>
                  <span className="text-muted-foreground">·</span>
                  <span className="truncate">{p.client}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="label-mono pb-1.5 text-muted-foreground">
              {lang === "tr" ? "Mesaj — dilediğin gibi düzenle" : "Message — edit as you like"}
            </p>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={7}
              className="w-full resize-none rounded-lg border border-border bg-background p-3 text-[13px] leading-relaxed text-foreground focus:outline-none focus:ring-1 focus:ring-primary/30"
            />
          </div>

          <p className="text-[11px] text-muted-foreground">
            {lang === "tr"
              ? `${proposals.length} teklife gönderilecek.`
              : `Will be sent to ${proposals.length} proposal${proposals.length === 1 ? "" : "s"}.`}
          </p>
          {error && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-[12px] text-destructive">{error}</p>}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-4">
          <button onClick={onClose} className="rounded-lg px-3 py-2 text-[13px] font-medium text-muted-foreground hover:bg-muted">
            {lang === "tr" ? "Vazgeç" : "Cancel"}
          </button>
          <button
            onClick={handleSend}
            disabled={sending || sent || proposals.length === 0}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-[13px] font-semibold text-white shadow-glow transition-opacity disabled:opacity-70",
            )}
            style={{ backgroundImage: "var(--grad-brand)" }}
          >
            {sending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : sent ? (
              <Check className="h-4 w-4" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            {sent ? (lang === "tr" ? "Gönderildi" : "Sent") : lang === "tr" ? "Gönder" : "Send"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
