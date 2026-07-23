"use client";

import { use, useEffect, useState } from "react";
import { CheckCircle2, Loader2, PenLine, ExternalLink, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLang } from "@/components/i18n/language-provider";
import { formatUsd } from "@/lib/utils";

type PublicProposal = {
  id: string;
  title: string;
  status: string;
  value: number;
  sections: { title: string; body: string }[];
  line_items: { name: string; qty: number; unit: number }[];
  contract_text: string | null;
  signed_at: string | null;
  clients: { name: string } | null;
};

export default function PublicProposalPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { lang } = useLang();
  const [proposal, setProposal] = useState<PublicProposal | null>(null);
  const [loading, setLoading] = useState(true);
  const [signing, setSigning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [redirecting, setRedirecting] = useState(false);
  const [payoutInfo, setPayoutInfo] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch(`/api/proposals/${id}/public`)
      .then((res) => res.json())
      .then((data) => {
        if (data.error) setError(data.error);
        else setProposal(data.proposal);
      })
      .catch(() => setError(lang === "tr" ? "Teklif yüklenemedi." : "Couldn't load the proposal."))
      .finally(() => setLoading(false));
  }, [id, lang]);

  async function sign() {
    setSigning(true);
    setError(null);
    try {
      const res = await fetch(`/api/proposals/${id}/sign`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || (lang === "tr" ? "İmzalama başarısız oldu." : "Signing failed."));
        setSigning(false);
        return;
      }
      setProposal((p) => (p ? { ...p, status: "accepted", signed_at: new Date().toISOString() } : p));
      const link: string | null = data.paymentLink;
      if (link && /^https?:\/\//i.test(link.trim())) {
        setRedirecting(true);
        window.location.href = link;
      } else if (link) {
        setPayoutInfo(link);
        setSigning(false);
      } else {
        setSigning(false);
      }
    } catch {
      setError(lang === "tr" ? "Bağlantı hatası." : "Connection error.");
      setSigning(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error && !proposal) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4 text-center">
        <p className="text-sm text-muted-foreground">{error}</p>
      </div>
    );
  }

  if (!proposal) return null;

  const total = proposal.line_items?.reduce((s, li) => s + li.qty * li.unit, 0) || proposal.value;
  const signed = proposal.status === "accepted";

  return (
    <div className="mx-auto min-h-screen max-w-2xl px-4 py-10 sm:py-16">
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-pop">
        <div className="border-b border-border p-6 sm:p-8">
          <p className="text-sm text-muted-foreground">{proposal.clients?.name}</p>
          <h1 className="font-display mt-1 text-2xl font-bold tracking-tight sm:text-3xl">{proposal.title}</h1>
        </div>

        <div className="space-y-6 p-6 sm:p-8">
          {proposal.sections?.map((s, i) => (
            <div key={i}>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{s.title}</p>
              <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed">{s.body}</p>
            </div>
          ))}

          {proposal.line_items?.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {lang === "tr" ? "Yatırım" : "Investment"}
              </p>
              <table className="w-full text-sm">
                <tbody>
                  {proposal.line_items.map((li, i) => (
                    <tr key={i} className="border-t border-border">
                      <td className="py-2">{li.name} × {li.qty}</td>
                      <td className="tnum py-2 text-right">{formatUsd(li.unit * li.qty)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-foreground">
                    <td className="py-2.5 font-semibold">{lang === "tr" ? "Toplam" : "Total"}</td>
                    <td className="tnum py-2.5 text-right font-bold">{formatUsd(total)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          {proposal.contract_text && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {lang === "tr" ? "Sözleşme Şartları" : "Contract Terms"}
              </p>
              <p className="mt-1.5 whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground">
                {proposal.contract_text}
              </p>
            </div>
          )}
        </div>

        <div className="border-t border-border bg-muted/30 p-6 sm:p-8">
          {signed ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 rounded-xl border border-success/30 bg-success/10 p-4 text-sm text-success">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                {redirecting
                  ? lang === "tr"
                    ? "İmzalandı — ödeme sayfasına yönlendiriliyorsun…"
                    : "Signed — redirecting you to payment…"
                  : lang === "tr"
                    ? "Bu teklif imzalandı. Teşekkürler!"
                    : "This proposal has been signed. Thank you!"}
              </div>
              {payoutInfo && (
                <div className="rounded-xl border border-border bg-card p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {lang === "tr" ? "Ödeme Bilgileri" : "Payment Details"}
                  </p>
                  <div className="mt-1.5 flex items-center gap-2">
                    <p className="flex-1 break-all text-sm font-medium">{payoutInfo}</p>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(payoutInfo);
                        setCopied(true);
                        setTimeout(() => setCopied(false), 1500);
                      }}
                      className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-border px-2.5 text-xs font-medium text-muted-foreground hover:bg-muted"
                    >
                      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                      {copied ? (lang === "tr" ? "Kopyalandı" : "Copied") : lang === "tr" ? "Kopyala" : "Copy"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <>
              <Button onClick={sign} disabled={signing} className="w-full gap-2" size="lg">
                {signing ? <Loader2 className="h-4 w-4 animate-spin" /> : <PenLine className="h-4 w-4" />}
                {lang === "tr" ? "Kabul Et & İmzala" : "Accept & Sign"}
              </Button>
              <p className="mt-2 flex items-center justify-center gap-1 text-center text-xs text-muted-foreground">
                <ExternalLink className="h-3 w-3" />
                {lang === "tr"
                  ? "İmzaladığında ajansın ödeme sayfasına yönlendirileceksin."
                  : "Once signed, you'll be redirected to the agency's payment page."}
              </p>
            </>
          )}
          {error && <p className="mt-2 text-center text-sm text-destructive">{error}</p>}
        </div>
      </div>
    </div>
  );
}
