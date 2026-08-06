"use client";

import { use, useEffect, useRef, useState } from "react";
import { CheckCircle2, Loader2, PenLine, ExternalLink, Copy, Check, FileText, CalendarClock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { useLang } from "@/components/i18n/language-provider";
import { cn, formatUsd } from "@/lib/utils";
import appConfig from "@/app.config";

type BillingOption = { key: string; label: { tr: string; en: string }; price: number; paymentLink?: string };
type LineItem = { name: string; qty: number; unit: number; optional?: boolean; included?: boolean };
type ClientContact = { company?: string; contactName?: string; title?: string; address?: string; phone?: string; email?: string; website?: string };
type Step = { title: string; body: string };

type PublicProposal = {
  id: string;
  title: string;
  status: string;
  value: number;
  sections: { title: string; body: string; condition?: { lineItem?: string; billingKey?: string } }[];
  line_items: LineItem[];
  contract_text: string | null;
  signed_at: string | null;
  signed_by_name: string | null;
  billing_options: BillingOption[];
  selected_billing: string | null;
  intro_text: string | null;
  about_text: string | null;
  client_contact: ClientContact;
  next_steps: Step[];
  valid_days: number;
  created_at: string;
  clients: { name: string } | null;
  companies: {
    name: string;
    logo_url: string | null;
    cover_image_url: string | null;
    primary_color: string | null;
    email: string | null;
    plan: string | null;
  } | null;
  team: { name: string; title: string | null; photo_url: string | null }[];
};

const TEAM_SECTION_RE = /ekib|ekip|team/i;

function fmtDate(iso: string, lang: "tr" | "en") {
  const d = new Date(iso);
  return d.toLocaleDateString(lang === "tr" ? "tr-TR" : "en-US", { day: "2-digit", month: "2-digit", year: "numeric" });
}

// Splits contract text into numbered clauses when the seller/AI wrote it as "1. ... 2. ..."; falls back to one block.
function splitClauses(text: string): string[] {
  const matches = text.split(/\n?(?=\d+\.\s)/).map((s) => s.trim()).filter(Boolean);
  return matches.length > 1 ? matches : [text];
}

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
  const [billingKey, setBillingKey] = useState<string | null>(null);
  const [items, setItems] = useState<LineItem[]>([]);
  const [signerName, setSignerName] = useState("");
  const [signerEmail, setSignerEmail] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [requestingOtp, setRequestingOtp] = useState(false);
  const [viewId, setViewId] = useState<string | null>(null);
  const skipLiveSelection = useRef(true);

  // Smart Proposal (Custom only): report the buyer's live toggle state so the seller can watch it in real time.
  useEffect(() => {
    if (skipLiveSelection.current) {
      skipLiveSelection.current = false;
      return;
    }
    if (proposal?.companies?.plan !== "custom" || proposal.status === "accepted") return;
    fetch(`/api/proposals/${id}/public/live-selection`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lineItems: items.map((i) => ({ name: i.name, included: i.included })), billingKey }),
    }).catch(() => {});
  }, [items, billingKey, id, proposal?.companies?.plan, proposal?.status]);

  useEffect(() => {
    fetch(`/api/proposals/${id}/public`)
      .then((res) => res.json())
      .then((data) => {
        if (data.error) setError(data.error);
        else {
          setProposal(data.proposal);
          setViewId(data.viewId ?? null);
          const options: BillingOption[] = data.proposal?.billing_options ?? [];
          setBillingKey(data.proposal?.selected_billing ?? options[0]?.key ?? null);
          setItems((data.proposal?.line_items ?? []).map((li: LineItem) => ({ ...li, included: li.optional ? !!li.included : true })));
          setSignerEmail(data.proposal?.client_contact?.email ?? "");
        }
      })
      .catch(() => setError(lang === "tr" ? "Teklif yüklenemedi." : "Couldn't load the proposal."))
      .finally(() => setLoading(false));
  }, [id, lang]);

  // Tracks how long each section stays visible in the viewport and flushes it as a beacon on tab-hide/unload.
  const sectionRefs = useRef<(HTMLDivElement | null)[]>([]);
  const visibleSince = useRef<Map<number, number>>(new Map());
  const accumulated = useRef<Map<number, number>>(new Map());

  useEffect(() => {
    if (!viewId || !proposal?.sections?.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const index = Number(entry.target.getAttribute("data-section-index"));
          if (entry.isIntersecting) {
            visibleSince.current.set(index, Date.now());
          } else {
            const since = visibleSince.current.get(index);
            if (since) {
              accumulated.current.set(index, (accumulated.current.get(index) ?? 0) + (Date.now() - since));
              visibleSince.current.delete(index);
            }
          }
        }
      },
      { threshold: 0.5 },
    );

    sectionRefs.current.forEach((el) => el && observer.observe(el));

    const flush = () => {
      const now = Date.now();
      for (const [index, since] of visibleSince.current) {
        accumulated.current.set(index, (accumulated.current.get(index) ?? 0) + (now - since));
      }
      visibleSince.current.clear();

      const sections = Array.from(accumulated.current.entries())
        .map(([index, ms]) => ({ index, seconds: Math.round(ms / 1000) }))
        .filter((s) => s.seconds > 0);
      if (sections.length === 0) return;

      const payload = JSON.stringify({ viewId, sections });
      navigator.sendBeacon?.(
        `/api/proposals/${id}/public/section-time`,
        new Blob([payload], { type: "application/json" }),
      );
      accumulated.current.clear();
    };

    const onVisibilityChange = () => document.hidden && flush();
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("pagehide", flush);

    return () => {
      flush();
      observer.disconnect();
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("pagehide", flush);
    };
  }, [viewId, id, proposal?.sections?.length]);

  const requiresOtp = !!(proposal?.companies?.plan && proposal.companies.plan !== "lite");

  async function requestOtp() {
    if (!signerEmail.trim()) {
      setError(lang === "tr" ? "Kod göndermek için email adresi gerekiyor." : "Email is required to send a code.");
      return;
    }
    setRequestingOtp(true);
    setError(null);
    try {
      const res = await fetch(`/api/proposals/${id}/sign/request-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: signerEmail.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || (lang === "tr" ? "Kod gönderilemedi." : "Couldn't send the code."));
      } else {
        setOtpSent(true);
      }
    } catch {
      setError(lang === "tr" ? "Bağlantı hatası." : "Connection error.");
    } finally {
      setRequestingOtp(false);
    }
  }

  async function sign() {
    if (!signerName.trim()) {
      setError(lang === "tr" ? "İmzalamak için adını yazman gerekiyor." : "Type your name to sign.");
      return;
    }
    if (requiresOtp && !otpCode.trim()) {
      setError(lang === "tr" ? "Doğrulama kodunu gir." : "Enter the verification code.");
      return;
    }
    setSigning(true);
    setError(null);
    try {
      const res = await fetch(`/api/proposals/${id}/sign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ billingKey, lineItems: items, signedByName: signerName.trim(), otpCode: otpCode.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || (lang === "tr" ? "İmzalama başarısız oldu." : "Signing failed."));
        setSigning(false);
        return;
      }
      setProposal((p) => (p ? { ...p, status: "accepted", signed_at: new Date().toISOString(), signed_by_name: signerName.trim() } : p));
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

  const billingOptions = proposal.billing_options ?? [];
  const selectedOption = billingOptions.find((o) => o.key === billingKey);
  const itemsTotal = items.reduce((s, li) => (li.optional && !li.included ? s : s + li.qty * li.unit), 0) || proposal.value;
  // Grand total = one-time line items (e.g. a setup fee) + the selected recurring billing option, if any.
  const total = itemsTotal + (selectedOption?.price ?? 0);
  const signed = proposal.status === "accepted";
  const company = proposal.companies;
  const client = proposal.client_contact ?? {};
  const brandColor = company?.primary_color || undefined;
  const validUntil = new Date(new Date(proposal.created_at).getTime() + (proposal.valid_days || 15) * 86400000);

  // A section bound to a lineItem or billingKey only shows while that exact choice is currently selected — mutually exclusive with any other choice.
  const visibleSections = (proposal.sections ?? [])
    .map((s, index) => ({ ...s, index }))
    .filter((s) => {
      if (!s.condition) return true;
      if (s.condition.lineItem) {
        const li = items.find((it) => it.name === s.condition!.lineItem);
        return !!li && (!li.optional || !!li.included);
      }
      if (s.condition.billingKey) return billingKey === s.condition.billingKey;
      return true;
    });

  const sectionLabel = (n: number) =>
    lang === "tr" ? `Bölüm ${n}` : `Section ${n}`;

  return (
    <div className="min-h-screen bg-muted/20 px-4 py-10 sm:py-16">
      <div className="mx-auto max-w-2xl overflow-hidden rounded-2xl border border-border bg-card shadow-pop">
        {/* Cover — Custom plan can replace the flat brand-color gradient with their own image ("premium design services"). */}
        <div
          className="relative overflow-hidden p-8 text-white sm:p-10"
          style={
            company?.plan === "custom" && company.cover_image_url
              ? { backgroundImage: `url(${company.cover_image_url})`, backgroundSize: "cover", backgroundPosition: "center" }
              : { background: brandColor ? `linear-gradient(135deg, ${brandColor}, color-mix(in oklch, ${brandColor} 60%, black))` : "var(--grad-brand)" }
          }
        >
          {company?.plan === "custom" && company.cover_image_url && (
            <span className="pointer-events-none absolute inset-0 bg-black/45" />
          )}
          <span className="pointer-events-none absolute -right-12 -top-16 h-56 w-56 rounded-full bg-white/10 blur-3xl" />
          <span className="pointer-events-none absolute -bottom-14 -left-8 h-48 w-48 rounded-full bg-black/10 blur-3xl" />
          <div className="relative flex items-center gap-2.5">
            {company?.logo_url ? (
              <span className="shadow-pill flex h-8 max-w-[140px] shrink-0 items-center overflow-hidden rounded-lg bg-white px-1.5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={company.logo_url} alt={company.name} className="h-full w-auto max-w-full object-contain" />
              </span>
            ) : (
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-white/15">
                <FileText className="h-4 w-4" />
              </span>
            )}
            <p className="text-sm font-medium text-white/85">{company?.name}</p>
          </div>

          <h1 className="font-display relative mt-6 text-2xl font-bold tracking-tight sm:text-3xl">{proposal.title}</h1>
          <p className="relative mt-1.5 text-sm text-white/70">
            {client.company || proposal.clients?.name} {lang === "tr" ? "için hazırlanmıştır" : "— prepared for"}
          </p>

          <div className="relative mt-6 grid grid-cols-2 gap-4 border-t border-white/15 pt-5 text-xs sm:grid-cols-4">
            <div>
              <p className="uppercase tracking-wide text-white/60">{lang === "tr" ? "Hazırlayan" : "From"}</p>
              <p className="mt-0.5 font-medium">{company?.name}</p>
            </div>
            <div>
              <p className="uppercase tracking-wide text-white/60">{lang === "tr" ? "Muhatap" : "To"}</p>
              <p className="mt-0.5 font-medium">{client.contactName || proposal.clients?.name || "—"}</p>
            </div>
            <div>
              <p className="uppercase tracking-wide text-white/60">{lang === "tr" ? "Teklif Tarihi" : "Date"}</p>
              <p className="tnum mt-0.5 font-medium">{fmtDate(proposal.created_at, lang)}</p>
            </div>
            <div>
              <p className="uppercase tracking-wide text-white/60">{lang === "tr" ? "Geçerlilik" : "Valid for"}</p>
              <p className="mt-0.5 font-medium">{proposal.valid_days} {lang === "tr" ? "gün" : "days"}</p>
            </div>
          </div>
        </div>

        <div className="space-y-8 p-6 sm:p-8">
          {/* Ön yazı */}
          {proposal.intro_text && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-primary">
                {lang === "tr" ? "Ön Yazı" : "Cover Letter"}
              </p>
              <p className="whitespace-pre-wrap text-sm leading-relaxed">{proposal.intro_text}</p>
            </div>
          )}

          {/* Hakkımızda */}
          {proposal.about_text && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-primary">
                {lang === "tr" ? "Hakkımızda" : "About Us"}
              </p>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">{proposal.about_text}</p>
            </div>
          )}

          {/* Taraflar */}
          {(company || client.contactName || client.company) && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-primary">
                {lang === "tr" ? "Taraflar" : "Parties"}
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-border p-3.5">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {lang === "tr" ? "Hizmeti Sunan" : "Provider"}
                  </p>
                  <p className="mt-1 text-sm font-semibold">{company?.name}</p>
                  {company?.email && <p className="text-xs text-muted-foreground">{company.email}</p>}
                  <p className="text-xs text-muted-foreground">{appConfig.domain}</p>
                </div>
                <div className="rounded-xl border border-border p-3.5">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {lang === "tr" ? "Hizmeti Alan" : "Client"}
                  </p>
                  <p className="mt-1 text-sm font-semibold">{client.company || proposal.clients?.name}</p>
                  {client.contactName && (
                    <p className="text-xs text-muted-foreground">
                      {client.contactName}{client.title ? ` — ${client.title}` : ""}
                    </p>
                  )}
                  {client.address && <p className="text-xs text-muted-foreground">{client.address}</p>}
                  {client.phone && <p className="text-xs text-muted-foreground">{client.phone}</p>}
                  {client.email && <p className="text-xs text-muted-foreground">{client.email}</p>}
                  {client.website && <p className="text-xs text-muted-foreground">{client.website}</p>}
                </div>
              </div>
            </div>
          )}

          {/* Hizmet kapsamı — checklist */}
          {visibleSections.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-primary">
                {lang === "tr" ? "Hizmet Kapsamı" : "Scope of Service"}
              </p>
              <div className="space-y-3">
                {visibleSections.map((s) => (
                  <div
                    key={s.index}
                    ref={(el) => {
                      sectionRefs.current[s.index] = el;
                    }}
                    data-section-index={s.index}
                    className="flex items-start gap-2.5"
                  >
                    <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                      <Check className="h-3 w-3" strokeWidth={3} />
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold">{s.title || sectionLabel(s.index + 1)}</p>
                      <p className="mt-0.5 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">{s.body}</p>
                      {TEAM_SECTION_RE.test(s.title) && proposal.team.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-3">
                          {proposal.team.map((m) => (
                            <div key={m.name} className="flex items-center gap-2 rounded-full border border-border bg-card py-1 pl-1 pr-3 shadow-pill">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={m.photo_url!} alt={m.name} className="h-7 w-7 rounded-full object-cover" />
                              <span className="text-xs">
                                <span className="font-semibold">{m.name}</span>
                                {m.title && <span className="text-muted-foreground"> · {m.title}</span>}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Paket ve ücret */}
          {(items.length > 0 || billingOptions.length > 0) && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-primary">
                {lang === "tr" ? "Paket ve Ücret" : "Package & Pricing"}
              </p>
              <div className="overflow-hidden rounded-2xl border border-border">
                {billingOptions.map((o) => {
                  const selected = billingKey === o.key;
                  const clickable = !signed;
                  return (
                    <div
                      key={o.key}
                      onClick={() => clickable && setBillingKey(o.key)}
                      className={cn(
                        "flex items-center gap-3 border-b border-border/70 px-4 py-3",
                        clickable && "cursor-pointer hover:bg-muted/40",
                      )}
                    >
                      <span
                        className={cn(
                          "grid h-5 w-5 shrink-0 place-items-center rounded-full",
                          selected ? "bg-primary text-primary-foreground" : "border border-border bg-card",
                        )}
                      >
                        {selected && <Check className="h-3 w-3" strokeWidth={3} />}
                      </span>
                      <span className="min-w-0 flex-1 text-sm font-medium">{lang === "tr" ? o.label.tr : o.label.en}</span>
                      <span className="tnum text-sm font-semibold">{formatUsd(o.price)}</span>
                    </div>
                  );
                })}
                {items.map((li, i) => {
                  const active = !li.optional || li.included;
                  const clickable = li.optional && !signed;
                  return (
                    <div
                      key={i}
                      onClick={() => clickable && setItems((prev) => prev.map((x, idx) => (idx === i ? { ...x, included: !x.included } : x)))}
                      className={cn(
                        "flex items-center gap-3 border-b border-border/70 px-4 py-3 last:border-0",
                        clickable && "cursor-pointer hover:bg-muted/40",
                        !active && "opacity-50",
                      )}
                    >
                      <span
                        className={cn(
                          "grid h-5 w-5 shrink-0 place-items-center rounded-full",
                          active ? (li.optional ? "bg-primary text-primary-foreground" : "bg-success text-white") : "border border-border bg-card",
                        )}
                      >
                        {active && <Check className="h-3 w-3" strokeWidth={3} />}
                      </span>
                      <span className="min-w-0 flex-1 text-sm font-medium">
                        {li.name}
                        <span className="ml-1.5 text-xs font-normal text-muted-foreground">× {li.qty}</span>
                        {li.optional && (
                          <span className="ml-1.5 text-[10px] font-normal text-muted-foreground">
                            ({lang === "tr" ? "opsiyonel" : "optional"})
                          </span>
                        )}
                      </span>
                      <span className="tnum text-sm font-semibold">{formatUsd(active ? li.unit * li.qty : 0)}</span>
                    </div>
                  );
                })}
              </div>
              <div className="mt-3 flex items-center justify-between rounded-xl bg-muted/50 px-4 py-3">
                <span className="text-sm font-semibold">{lang === "tr" ? "Toplam" : "Total"}</span>
                <span className="tnum text-xl font-bold text-primary">{formatUsd(total)}</span>
              </div>
            </div>
          )}

          {/* Sözleşme koşulları */}
          {proposal.contract_text && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-primary">
                {lang === "tr" ? "Sözleşme Koşulları" : "Contract Terms"}
              </p>
              <div className="space-y-2">
                {splitClauses(proposal.contract_text).map((clause, i) => (
                  <p key={i} className="whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground">
                    {clause}
                  </p>
                ))}
              </div>
            </div>
          )}

          {/* Sonraki adımlar */}
          {proposal.next_steps?.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-primary">
                {lang === "tr" ? "Sonraki Adımlar" : "Next Steps"}
              </p>
              <div className="space-y-3">
                {proposal.next_steps.map((step, i) => (
                  <div key={i} className="flex items-start gap-2.5">
                    <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-success/10 text-success">
                      <Check className="h-3 w-3" strokeWidth={3} />
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold">
                        {i + 1}. {step.title}
                      </p>
                      <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">{step.body}</p>
                    </div>
                  </div>
                ))}
              </div>
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
              {proposal.signed_by_name && (
                <p className="text-xs text-muted-foreground">
                  {lang === "tr" ? "İmzalayan: " : "Signed by: "}
                  <span className="font-medium text-foreground">{proposal.signed_by_name}</span>
                  {proposal.signed_at && ` · ${new Date(proposal.signed_at).toLocaleString(lang === "tr" ? "tr-TR" : "en-US")}`}
                </p>
              )}
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
              <div className="mb-3 space-y-1.5">
                <Label htmlFor="signer-name">
                  {lang === "tr" ? "Adın (imza olarak kaydedilecek)" : "Your name (recorded as your signature)"}
                </Label>
                <Input
                  id="signer-name"
                  value={signerName}
                  onChange={(e) => setSignerName(e.target.value)}
                  placeholder={lang === "tr" ? "Ad Soyad" : "Full name"}
                />
              </div>
              {requiresOtp && (
                <div className="mb-3 space-y-1.5">
                  <Label htmlFor="signer-email">{lang === "tr" ? "Email (doğrulama kodu için)" : "Email (for verification code)"}</Label>
                  <div className="flex gap-2">
                    <Input
                      id="signer-email"
                      type="email"
                      value={signerEmail}
                      onChange={(e) => setSignerEmail(e.target.value)}
                      placeholder={lang === "tr" ? "email@ornek.com" : "email@example.com"}
                      disabled={otpSent}
                    />
                    {!otpSent && (
                      <Button variant="outline" onClick={requestOtp} disabled={requestingOtp} className="shrink-0">
                        {requestingOtp ? <Loader2 className="h-4 w-4 animate-spin" /> : lang === "tr" ? "Kod gönder" : "Send code"}
                      </Button>
                    )}
                  </div>
                  {otpSent && (
                    <Input
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value)}
                      placeholder={lang === "tr" ? "6 haneli kod" : "6-digit code"}
                      className="mt-2"
                    />
                  )}
                </div>
              )}
              <Button onClick={sign} disabled={signing || (requiresOtp && !otpSent)} className="w-full gap-2" size="lg">
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

        <div className="flex items-center justify-center gap-1.5 border-t border-border p-4 text-xs text-muted-foreground">
          <CalendarClock className="h-3.5 w-3.5" />
          {lang === "tr"
            ? `${appConfig.name} — ${company?.name} · Bu teklif ${fmtDate(proposal.created_at, lang)} tarihinden itibaren ${proposal.valid_days} gün geçerlidir (${fmtDate(validUntil.toISOString(), lang)}'e kadar).`
            : `${appConfig.name} — ${company?.name} · This proposal is valid for ${proposal.valid_days} days from ${fmtDate(proposal.created_at, lang)} (until ${fmtDate(validUntil.toISOString(), lang)}).`}
        </div>
      </div>
    </div>
  );
}
