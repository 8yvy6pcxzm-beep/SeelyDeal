"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { PenLine, ShieldCheck, Clock, Globe, ChevronDown, FileText, ScrollText } from "lucide-react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { useLang } from "@/components/i18n/language-provider";
import { usePlan } from "@/components/app/plan-provider";
import { planAllows } from "@/lib/plan";
import { formatUsd, formatDate, cn } from "@/lib/utils";
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
      signed_by_name: p.clientEmail
        .split("@")[0]
        .replace(".", " ")
        .replace(/\b\w/g, (c) => c.toUpperCase()),
      signed_ip: i === 0 ? "88.230.14.2" : "51.15.201.44",
    }));
}

type BlockSignature = {
  block_id: string;
  block_type: string;
  signer_name: string;
  signer_email: string | null;
  otp_verified: boolean;
  ip: string | null;
  signed_at: string;
};

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
  block_signatures?: BlockSignature[];
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
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  function toggleExpanded(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

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
        // Include proposals with a full accept/sign, and also ones with only block-level
        // signatures so far (a Legal clause signed before the buyer finishes the whole proposal).
        const signed = (data.proposals ?? [])
          .filter((p: SignatureRow) => (p.status === "accepted" && p.signed_at) || (p.block_signatures?.length ?? 0) > 0)
          .sort((a: SignatureRow, b: SignatureRow) => {
            const aLatest = a.signed_at || a.block_signatures?.[0]?.signed_at || "";
            const bLatest = b.signed_at || b.block_signatures?.[0]?.signed_at || "";
            return bLatest > aLatest ? 1 : -1;
          });
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
         <div className="overflow-x-auto">
          <div className="grid min-w-[640px] grid-cols-[1fr_auto_auto_auto] gap-4 border-b border-border px-6 py-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            <span>{lang === "tr" ? "Teklif" : "Proposal"}</span>
            <span>{lang === "tr" ? "İmzalayan" : "Signed by"}</span>
            <span>{lang === "tr" ? "Tarih" : "Date"}</span>
            <span>{lang === "tr" ? "Değer" : "Value"}</span>
          </div>
          <div className="min-w-[640px] divide-y divide-border">
            {rows.map((r) => {
              const blockSigs = r.block_signatures ?? [];
              const isOpen = expanded.has(r.id);
              return (
                <div key={r.id}>
                  <button
                    type="button"
                    onClick={() => blockSigs.length > 0 && toggleExpanded(r.id)}
                    className={cn(
                      "grid w-full grid-cols-[1fr_auto_auto_auto] items-center gap-4 px-6 py-3.5 text-left",
                      blockSigs.length > 0 && "cursor-pointer hover:bg-muted/40",
                    )}
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      {blockSigs.length > 0 && (
                        <ChevronDown className={cn("h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform", isOpen && "rotate-180")} />
                      )}
                      <div className="min-w-0">
                        <p className="truncate text-[13.5px] font-medium">{r.title}</p>
                        <p className="truncate text-[12px] text-muted-foreground">
                          {r.number} · {r.client}
                          {blockSigs.length > 0 &&
                            ` · ${blockSigs.length} ${lang === "tr" ? "blok imzası" : "block signature" + (blockSigs.length > 1 ? "s" : "")}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 text-[12.5px] text-foreground">
                      {r.signed_by_name ? (
                        <>
                          <ShieldCheck className="h-3.5 w-3.5 text-success" />
                          <span>{r.signed_by_name}</span>
                          {r.signed_ip && (
                            <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                              <Globe className="h-3 w-3" /> {r.signed_ip}
                            </span>
                          )}
                        </>
                      ) : (
                        <span className="text-[11px] text-muted-foreground">
                          {lang === "tr" ? "Tekliften önce kısmen imzalandı" : "Partially signed pre-accept"}
                        </span>
                      )}
                    </div>
                    <span className="flex items-center gap-1.5 text-[12.5px] tabular-nums text-muted-foreground">
                      <Clock className="h-3.5 w-3.5" /> {r.signed_at ? formatDate(r.signed_at) : "—"}
                    </span>
                    <span className="text-[13.5px] font-medium tabular-nums">{formatUsd(r.value)}</span>
                  </button>

                  {isOpen && blockSigs.length > 0 && (
                    <div className="space-y-2 bg-muted/20 px-6 py-3 pl-12">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        {lang === "tr" ? "Blok bazlı imzalar" : "Block-level signatures"}
                      </p>
                      {blockSigs.map((s) => (
                        <div key={s.block_id} className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border border-border bg-card px-3 py-2 text-[12px]">
                          <span className="flex items-center gap-1.5 font-medium">
                            {s.block_type === "Legal" ? <FileText className="h-3.5 w-3.5 text-muted-foreground" /> : <ScrollText className="h-3.5 w-3.5 text-muted-foreground" />}
                            {s.block_type === "Legal" ? (lang === "tr" ? "Yasal madde" : "Legal clause") : (lang === "tr" ? "Sözleşme" : "Contract")}
                          </span>
                          <span className="flex items-center gap-1.5 text-foreground">
                            <ShieldCheck className="h-3.5 w-3.5 text-success" /> {s.signer_name}
                          </span>
                          {s.signer_email && <span className="text-muted-foreground">{s.signer_email}</span>}
                          {s.otp_verified && (
                            <span className="rounded-full bg-success/10 px-2 py-0.5 text-[10px] font-medium text-success">
                              {lang === "tr" ? "Kod doğrulandı" : "Code verified"}
                            </span>
                          )}
                          {s.ip && (
                            <span className="flex items-center gap-1 text-muted-foreground">
                              <Globe className="h-3 w-3" /> {s.ip}
                            </span>
                          )}
                          <span className="ml-auto flex items-center gap-1 tabular-nums text-muted-foreground">
                            <Clock className="h-3 w-3" /> {formatDate(s.signed_at)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
         </div>
        </Card>
      )}
    </div>
  );
}
