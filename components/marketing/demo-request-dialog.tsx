"use client";

import { useState } from "react";
import { X, Loader2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { useLang } from "@/components/i18n/language-provider";

export function DemoRequestDialog({ tier, onClose }: { tier: string; onClose: () => void }) {
  const { lang } = useLang();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const isCustom = tier === "Custom";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/demo-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, company, message, tier }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error || (lang === "tr" ? "Gönderilemedi." : "Couldn't submit."));
        return;
      }
      setSent(true);
    } catch {
      setError(lang === "tr" ? "Bağlantı hatası." : "Connection error.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-pop"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="font-display text-lg font-semibold">
            {isCustom
              ? lang === "tr"
                ? "İletişim talebi"
                : "Contact request"
              : lang === "tr"
                ? "Demo Rezervasyonu"
                : "Demo Booking"}
          </h3>
          <button onClick={onClose} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>

        {sent ? (
          <div className="mt-5 flex flex-col items-center gap-2 rounded-xl border border-success/30 bg-success/10 p-5 text-center">
            <Check className="h-5 w-5 text-success" />
            <p className="text-sm font-medium text-success">
              {lang === "tr" ? "Talebin alındı, en kısa sürede sana ulaşacağız." : "Got it — we'll reach out shortly."}
            </p>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-4 space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="dr-name">{lang === "tr" ? "İsim" : "Name"}</Label>
              <Input id="dr-name" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dr-email">{lang === "tr" ? "E-posta" : "Email"}</Label>
              <Input id="dr-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dr-company">{lang === "tr" ? "Şirket (opsiyonel)" : "Company (optional)"}</Label>
              <Input id="dr-company" value={company} onChange={(e) => setCompany(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dr-message">{lang === "tr" ? "Mesaj (opsiyonel)" : "Message (optional)"}</Label>
              <textarea
                id="dr-message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={3}
                className="flex w-full resize-none rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-ring transition-colors"
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" disabled={loading} className="w-full gap-2">
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {lang === "tr" ? "Gönder" : "Send"}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
