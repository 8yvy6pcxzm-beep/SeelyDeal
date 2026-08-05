"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { PenLine, ShieldCheck, Clock, Globe } from "lucide-react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { useLang } from "@/components/i18n/language-provider";
import { usePlan } from "@/components/app/plan-provider";
import { planAllows } from "@/lib/plan";
import { formatUsd, formatDate } from "@/lib/utils";
import { proposals as demoProposals } from "@/lib/demo/data";

/** Two of the curated demo proposals, dressed up with plausible signer details, for the unauthenticated /demo shell (the real API just returns an empty list when logged out, so it can't tell us "this is a demo"). */
function demoSignatureRows(): SignatureRow[] {
  return demoProposals
    .filter((p) => p.status === "accepted")
    .slice(0, 2)
    .map((p, i) => ({
      id: p.id,
      number: p.number,
      title: p.title.tr,
      value: p.value,
      status: p.status,
      client: p.client,
      signed_at: p.sentDate,
      signed_by_name: p.clientEmail.split("@")[0].replace(".", " "),
      signed_ip: i === 0 ? "88.230.14.2" : "51.15.201.44",
    }));
}

type SignatureRow = {
  id: string;
  number: string;
  title: string;
  value: number;
  status: string;
  client: string;
  signed_at: string | null;
  signed_by_name: string | null;
  signed_ip: string | null;
};

/** Audit trail of every proposal signature — who signed, when, and from what IP. Pro and Custom only: it's the record-keeping layer on top of the e-signature feature already gated to those plans. */
export default function SignaturesPage() {
  const { lang } = useLang();
  const plan = usePlan();
  const pathname = usePathname();
  const isDemo = pathname?.startsWith("/demo") ?? false;
  const allowed = planAllows(plan, "signatures");
  const [rows, setRows] = useState<SignatureRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!allowed) {
      setLoading(false);
      return;
    }
    if (isDemo) {
      setRows(demoSignatureRows());
      setLoading(false);
      return;
    }
    fetch("/api/proposals")
      .then((res) => res.json())
      .then((data) => {
        const signed = (data.proposals ?? [])
          .filter((p: SignatureRow) => p.status === "accepted" && p.signed_at)
          .sort((a: SignatureRow, b: SignatureRow) => (b.signed_at! > a.signed_at! ? 1 : -1));
        setRows(signed);
      })
      .finally(() => setLoading(false));
  }, [allowed, isDemo]);

  if (!allowed) {
    return (
      <div className="mx-auto max-w-[1100px]">
        <Card>
          <CardHeader>
            <CardTitle>{lang === "tr" ? "İmzalar" : "Signatures"}</CardTitle>
            <p className="text-sm text-muted-foreground">
              {lang === "tr"
                ? "İmza denetim kaydı Pro ve Custom paketlerinde kullanılabilir. Ücretsiz deneme (Lite) bu özelliği içermez."
                : "The signature audit trail is available on the Pro and Custom plans. The free trial (Lite) doesn't include this feature."}
            </p>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1100px] animate-fade-in space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight">
          {lang === "tr" ? "İmzalar" : "Signatures"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {lang === "tr"
            ? "İmzalanan her teklifin kim, ne zaman ve hangi IP'den imzaladığına dair denetim kaydı."
            : "Audit trail of every signed proposal — who signed it, when, and from what IP."}
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">{lang === "tr" ? "Yükleniyor…" : "Loading…"}</p>
      ) : rows.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-[14px]">
              <PenLine className="h-4 w-4 text-muted-foreground" />
              {lang === "tr" ? "Henüz imzalanan teklif yok" : "No signed proposals yet"}
            </CardTitle>
          </CardHeader>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="grid grid-cols-[1fr_auto_auto_auto] gap-4 border-b border-border px-6 py-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            <span>{lang === "tr" ? "Teklif" : "Proposal"}</span>
            <span>{lang === "tr" ? "İmzalayan" : "Signed by"}</span>
            <span>{lang === "tr" ? "Tarih" : "Date"}</span>
            <span>{lang === "tr" ? "Değer" : "Value"}</span>
          </div>
          <div className="divide-y divide-border">
            {rows.map((r) => (
              <div key={r.id} className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-4 px-6 py-3.5">
                <div className="min-w-0">
                  <p className="truncate text-[13.5px] font-medium">{r.title}</p>
                  <p className="truncate text-[12px] text-muted-foreground">
                    {r.number} · {r.client}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 text-[12.5px] text-foreground">
                  <ShieldCheck className="h-3.5 w-3.5 text-success" />
                  <span>{r.signed_by_name}</span>
                  {r.signed_ip && (
                    <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                      <Globe className="h-3 w-3" /> {r.signed_ip}
                    </span>
                  )}
                </div>
                <span className="flex items-center gap-1.5 text-[12.5px] tabular-nums text-muted-foreground">
                  <Clock className="h-3.5 w-3.5" /> {r.signed_at ? formatDate(r.signed_at) : "—"}
                </span>
                <span className="text-[13.5px] font-medium tabular-nums">{formatUsd(r.value)}</span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
