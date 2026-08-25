"use client";

import { use, useEffect, useRef, useState } from "react";
import { Hanken_Grotesk, Playfair_Display } from "next/font/google";
import { CheckCircle2, Loader2, PenLine, ExternalLink, Copy, Check, FileText, CalendarClock, Info, ListChecks, CreditCard, ScrollText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { useLang } from "@/components/i18n/language-provider";
import { cn, formatUsd } from "@/lib/utils";
import appConfig from "@/app.config";
import { isProposalFontKey, type ProposalFontKey } from "@/lib/proposal-fonts";
import { BlockRenderer } from "@/components/app/blocks/block-renderer";
import type { ProposalBlock } from "@/lib/types/proposal-blocks";
import type { BlockSignState } from "@/components/app/blocks/block-sign-form";
import { legacyToBlocks } from "@/lib/proposal-blocks/convert-legacy";

// Loaded for proposals whose theme (from a template, or the company's own default —
// see lib/proposal-fonts.ts) declares a non-default font — applied via inline style
// below, so it never touches the app-wide font. "default" needs no extra load, it's
// the app's own --font-display-app (Instrument Sans).
const hankenGrotesk = Hanken_Grotesk({ subsets: ["latin"], weight: ["700", "800"] });
const playfairDisplay = Playfair_Display({ subsets: ["latin"], weight: ["700", "800"] });

/** theme.font holds either one of our curated keys (see lib/proposal-fonts.ts, set by
 * onboarding or a company default) or an older free-text template value (e.g. the
 * built-in "Hanken Grotesk" demo template) — any non-empty, non-"default" value that
 * isn't recognized falls back to "bold" (Hanken Grotesk) to match the old behavior,
 * where ANY truthy theme.font switched away from the app's own display font. */
function displayFontFamily(fontKey: string | undefined): string | undefined {
  if (!fontKey || fontKey === "default") return undefined;
  const key: ProposalFontKey = isProposalFontKey(fontKey) ? fontKey : "bold";
  if (key === "elegant") return playfairDisplay.style.fontFamily;
  return hankenGrotesk.style.fontFamily;
}

type BillingOption = { key: string; label: { tr: string; en: string }; price: number; paymentLink?: string };
type LineItem = { name: string; qty: number; unit: number; optional?: boolean; included?: boolean };
type ClientContact = { company?: string; contactName?: string; title?: string; address?: string; phone?: string; email?: string; website?: string };
type Step = { title: string; body: string };

type PublicProposal = {
  id: string;
  title: string;
  status: string;
  value: number;
  sections: { title: string; body: string; videoUrl?: string; condition?: { lineItem?: string; billingKey?: string } }[];
  line_items: LineItem[];
  blocks: ProposalBlock[];
  blockSignatures: { block_id: string; signer_name: string; signed_at: string }[];
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
    address: string | null;
    phone: string | null;
    plan: string | null;
  } | null;
  team: { name: string; title: string | null; photo_url: string | null }[];
  /** Optional per-proposal theme carried from a template (e.g. the construction template) —
   *  only overrides colors/font for this one proposal, never the app-wide defaults. */
  theme_json: { primaryColor: string; accentColor: string; font?: string } | null;
  /** "pages" (default) = sidebar, one section at a time. "scroll" = classic single scrolling page. */
  view_mode: "pages" | "scroll" | null;
};

const TEAM_SECTION_RE = /ekib|ekip|team/i;

function fmtDate(iso: string, lang: "tr" | "en") {
  const d = new Date(iso);
  return d.toLocaleDateString(lang === "tr" ? "tr-TR" : "en-US", { day: "2-digit", month: "2-digit", year: "numeric" });
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
  const [blockSignatures, setBlockSignatures] = useState<Record<string, { signerName: string; signedAt: string }>>({});
  const [signingBlockId, setSigningBlockId] = useState<string | null>(null);
  const [blockError, setBlockError] = useState<{ blockId: string; message: string } | null>(null);
  const [viewId, setViewId] = useState<string | null>(null);
  const skipLiveSelection = useRef(true);
  // Which "page" is currently shown when view_mode is "pages" — the proposal renders as a
  // sidebar-navigated, one-page-at-a-time document (like a small site) instead of one long
  // scroll. When view_mode is "scroll" all sections render stacked and this just tracks which
  // one is under the viewport, for the sidebar's active-item highlight (scroll-spy).
  const [activeNav, setActiveNav] = useState<string>("kapak");
  const mainRef = useRef<HTMLDivElement | null>(null);
  const sectionElRefs = useRef<Record<string, HTMLElement | null>>({});
  const viewMode: "pages" | "scroll" = proposal?.view_mode === "scroll" ? "scroll" : "pages";

  function goToNav(key: string) {
    if (viewMode === "scroll") {
      sectionElRefs.current[key]?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    setActiveNav(key);
    mainRef.current?.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
  }

  // Scroll-spy: in "scroll" mode, tracks which section band is currently under the top of
  // the scrollable main area, so the sidebar can highlight it (mirrors the old top-nav behavior).
  useEffect(() => {
    if (viewMode !== "scroll" || !mainRef.current) return;
    const els = Object.entries(sectionElRefs.current).filter(([, el]) => el) as [string, HTMLElement][];
    if (els.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting);
        if (visible.length === 0) return;
        const top = visible.reduce((a, b) => (a.boundingClientRect.top < b.boundingClientRect.top ? a : b));
        const key = els.find(([, el]) => el === top.target)?.[0];
        if (key) setActiveNav(key);
      },
      { root: mainRef.current, rootMargin: "-15% 0px -70% 0px", threshold: 0 },
    );
    els.forEach(([, el]) => observer.observe(el));
    return () => observer.disconnect();
  }, [viewMode, proposal]);

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
          setBlockSignatures(
            Object.fromEntries(
              (data.proposal?.blockSignatures ?? []).map((s: { block_id: string; signer_name: string; signed_at: string }) => [
                s.block_id,
                { signerName: s.signer_name, signedAt: s.signed_at },
              ]),
            ),
          );
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
  }, [viewId, id, proposal?.sections?.length, activeNav]);

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

  // Signs a single Legal/ContractSignOff block, independent of the whole-proposal
  // "Accept & Sign" above — the audit trail lives in `block_signatures`, keyed by block id.
  async function signBlock(blockId: string, blockType: "Legal" | "ContractSignOff") {
    if (!signerName.trim()) {
      setBlockError({ blockId, message: lang === "tr" ? "İmzalamak için adını yazman gerekiyor." : "Type your name to sign." });
      return;
    }
    if (requiresOtp && !otpCode.trim()) {
      setBlockError({ blockId, message: lang === "tr" ? "Doğrulama kodunu gir." : "Enter the verification code." });
      return;
    }
    setSigningBlockId(blockId);
    setBlockError(null);
    try {
      const res = await fetch(`/api/proposals/${id}/blocks/${blockId}/sign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ blockType, signerName: signerName.trim(), signerEmail: signerEmail.trim(), otpCode: otpCode.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setBlockError({ blockId, message: data.error || (lang === "tr" ? "İmzalama başarısız oldu." : "Signing failed.") });
        return;
      }
      setBlockSignatures((m) => ({
        ...m,
        [blockId]: { signerName: data.signature.signer_name, signedAt: data.signature.signed_at },
      }));
    } catch {
      setBlockError({ blockId, message: lang === "tr" ? "Bağlantı hatası." : "Connection error." });
    } finally {
      setSigningBlockId(null);
    }
  }

  function getBlockSignState(blockId: string, blockType: "Legal" | "ContractSignOff"): BlockSignState {
    return {
      signature: blockSignatures[blockId] ?? null,
      signerName,
      onSignerNameChange: setSignerName,
      requiresOtp,
      otpEmail: signerEmail,
      onOtpEmailChange: setSignerEmail,
      otpSent,
      requestingOtp,
      onRequestOtp: requestOtp,
      otpCode,
      onOtpCodeChange: setOtpCode,
      signing: signingBlockId === blockId,
      onSign: () => signBlock(blockId, blockType),
      error: blockError?.blockId === blockId ? blockError.message : null,
    };
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
  const theme = proposal.theme_json;
  const brandColor = theme?.primaryColor || company?.primary_color || undefined;
  const accentColor = theme?.accentColor || undefined;
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

  const hasSummary = !!(proposal.intro_text || proposal.about_text || company || client.contactName || client.company);
  const hasScope = visibleSections.length > 0;
  const hasPricing = items.length > 0 || billingOptions.length > 0;

  // Legal/ContractSignOff blocks — from `blocks[]` when the proposal was authored
  // with the block editor, or derived from the legacy contract_text column otherwise
  // (see lib/proposal-blocks/convert-legacy.ts). Rendered via BlockRenderer below so
  // each one carries its own independent sign form + audit trail (block_signatures).
  const signableBlocks = (proposal.blocks?.length ? proposal.blocks : legacyToBlocks({ contractText: proposal.contract_text ?? undefined })).filter(
    (b): b is Extract<ProposalBlock, { type: "Legal" | "ContractSignOff" }> => b.type === "Legal" || b.type === "ContractSignOff",
  );
  const pendingRequiredSignatures = signableBlocks.filter(
    (b) => b.type === "Legal" && b.settings.requireSignature && !blockSignatures[b.id],
  ).length;
  const hasContract = signableBlocks.length > 0 || proposal.next_steps?.length > 0;

  // The sidebar's pages — only lists bands that actually exist in this proposal. Each is its
  // own full-screen "page", switched with `activeNav` instead of scrolled to.
  const navItems: { key: string; label: string; icon: typeof FileText }[] = [
    { key: "kapak", label: lang === "tr" ? "Kapak" : "Cover", icon: FileText },
    ...(hasSummary ? [{ key: "ozet", label: lang === "tr" ? "Özet" : "Summary", icon: Info }] : []),
    ...(hasScope ? [{ key: "kapsam", label: lang === "tr" ? "Kapsam" : "Scope", icon: ListChecks }] : []),
    ...(hasPricing ? [{ key: "fiyat", label: lang === "tr" ? "Fiyatlandırma" : "Pricing", icon: CreditCard }] : []),
    ...(hasContract ? [{ key: "sozlesme", label: lang === "tr" ? "Sözleşme" : "Contract", icon: ScrollText }] : []),
    { key: "onayla", label: lang === "tr" ? "Onayla" : "Approve", icon: PenLine },
  ];

  return (
    <div
      className="flex min-h-screen bg-background text-foreground"
      style={
        theme?.font && displayFontFamily(theme.font)
          ? ({ "--font-display": displayFontFamily(theme.font) } as React.CSSProperties)
          : undefined
      }
    >
      {/* Sidebar — each item is its own full page, switched via `activeNav` (no scrolling between them). */}
      <aside className="hidden w-60 shrink-0 flex-col border-r border-border bg-card md:flex">
        <div className="flex h-16 shrink-0 items-center gap-2.5 border-b border-border px-4">
          {company?.logo_url ? (
            <span className="flex h-7 max-w-[120px] shrink-0 items-center overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={company.logo_url} alt={company.name} className="h-full w-auto max-w-full object-contain" />
            </span>
          ) : (
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg" style={{ background: brandColor || "var(--grad-brand)" }}>
              <FileText className="h-3.5 w-3.5 text-white" />
            </span>
          )}
          {company?.name && <span className="truncate font-display text-sm font-bold">{company.name}</span>}
        </div>
        <nav className="flex-1 space-y-0.5 p-3">
          {navItems.map((n) => (
            <button
              key={n.key}
              onClick={() => goToNav(n.key)}
              className={cn(
                "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-xs font-medium transition-colors",
                activeNav === n.key ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <n.icon className="h-3.5 w-3.5 shrink-0" />
              {n.label}
            </button>
          ))}
        </nav>
        <div className="shrink-0 border-t border-border p-3">
          {signed ? (
            <span className="flex items-center justify-center gap-1.5 rounded-full bg-success/10 px-3 py-1.5 text-xs font-semibold text-success">
              <CheckCircle2 className="h-3.5 w-3.5" />
              {lang === "tr" ? "İmzalandı" : "Signed"}
            </span>
          ) : (
            <Button
              size="sm"
              onClick={() => goToNav("onayla")}
              className="w-full"
              style={accentColor ? { backgroundColor: accentColor, borderColor: accentColor } : undefined}
            >
              {lang === "tr" ? "Teklifi Onayla" : "Accept Proposal"}
            </Button>
          )}
        </div>
      </aside>

      {/* Mobile top bar — same page list, as a horizontal scroller (no sidebar space on small screens). */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-50 flex h-14 items-center gap-1 overflow-x-auto border-b border-border bg-card/95 px-3 backdrop-blur md:hidden">
          {navItems.map((n) => (
            <button
              key={n.key}
              onClick={() => goToNav(n.key)}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                activeNav === n.key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted",
              )}
            >
              <n.icon className="h-3 w-3 shrink-0" />
              {n.label}
            </button>
          ))}
        </header>

        <main ref={mainRef} className="flex-1 overflow-y-auto">
      {/* Kapak / hero — Custom plan can replace the flat brand-color gradient with their own image. */}
      {(viewMode === "scroll" || activeNav === "kapak") && (
      <section
        ref={(el) => {
          sectionElRefs.current.kapak = el;
        }}
        className="relative overflow-hidden px-4 py-20 text-white sm:px-8 sm:py-28"
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
        <div className="relative mx-auto max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-widest text-white/60">
            {lang === "tr" ? "Teklif" : "Proposal"}
          </p>
          <h1 className="font-display mt-4 text-4xl font-bold tracking-tight sm:text-5xl">{proposal.title}</h1>

          <div className="mt-10 grid grid-cols-2 gap-6 border-t border-white/15 pt-6 text-xs sm:grid-cols-4">
            <div>
              <p className="uppercase tracking-wide text-white/60">{lang === "tr" ? "Hazırlayan" : "From"}</p>
              <p className="mt-1 font-medium">{company?.name}</p>
            </div>
            <div>
              <p className="uppercase tracking-wide text-white/60">{lang === "tr" ? "Muhatap" : "To"}</p>
              <p className="mt-1 font-medium">{client.contactName || proposal.clients?.name || "—"}</p>
            </div>
            <div>
              <p className="uppercase tracking-wide text-white/60">{lang === "tr" ? "Teklif Tarihi" : "Date"}</p>
              <p className="tnum mt-1 font-medium">{fmtDate(proposal.created_at, lang)}</p>
            </div>
            <div>
              <p className="uppercase tracking-wide text-white/60">{lang === "tr" ? "Geçerlilik" : "Valid for"}</p>
              <p className="mt-1 font-medium">{proposal.valid_days} {lang === "tr" ? "gün" : "days"}</p>
            </div>
          </div>
        </div>
      </section>
      )}

      {/* Özet — cover letter, about, parties */}
      {(viewMode === "scroll" || activeNav === "ozet") && hasSummary && (
        <section
          ref={(el) => {
            sectionElRefs.current.ozet = el;
          }}
          className="px-4 py-16 sm:px-8 sm:py-20"
        >
          <div className="mx-auto max-w-3xl space-y-10">
            <h2 className="font-display text-2xl font-bold">{lang === "tr" ? "Özet" : "Summary"}</h2>

            {proposal.intro_text && (
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-primary">
                  {lang === "tr" ? "Ön Yazı" : "Cover Letter"}
                </p>
                <p className="whitespace-pre-wrap text-sm leading-relaxed">{proposal.intro_text}</p>
              </div>
            )}

            {proposal.about_text && (
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-primary">
                  {lang === "tr" ? "Hakkımızda" : "About Us"}
                </p>
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">{proposal.about_text}</p>
              </div>
            )}

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
                    {company?.address && <p className="text-xs text-muted-foreground">{company.address}</p>}
                    {company?.phone && <p className="text-xs text-muted-foreground">{company.phone}</p>}
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
          </div>
        </section>
      )}

      {/* Kapsam — hizmet kapsamı checklist */}
      {(viewMode === "scroll" || activeNav === "kapsam") && hasScope && (
        <section
          ref={(el) => {
            sectionElRefs.current.kapsam = el;
          }}
          className="bg-muted/20 px-4 py-16 sm:px-8 sm:py-20"
        >
          <div className="mx-auto max-w-3xl">
            <h2 className="font-display mb-8 text-2xl font-bold">{lang === "tr" ? "Hizmet Kapsamı" : "Scope of Service"}</h2>
            <div className="space-y-3">
              <BlockRenderer
                blocks={visibleSections.map(
                  (s): ProposalBlock => ({
                    id: `section-${s.index}`,
                    type: "RichSection",
                    label: s.title || sectionLabel(s.index + 1),
                    body: s.body,
                    icon: TEAM_SECTION_RE.test(s.title) ? "team" : undefined,
                    videoUrl: s.videoUrl,
                    sectionIndex: s.index,
                  }),
                )}
                ctx={{
                  title: proposal.title,
                  client: client.company || proposal.clients?.name || "",
                  value: proposal.value,
                  lineItems: items.map((li, i) => ({ id: String(i), name: li.name, unit: li.unit, qty: li.qty, optional: li.optional })),
                  lang,
                  sectionVariant: "checklist",
                  team: proposal.team,
                  getSectionRef: (index) => (el) => {
                    sectionRefs.current[index] = el;
                  },
                }}
              />
            </div>
          </div>
        </section>
      )}

      {/* Fiyatlandırma */}
      {(viewMode === "scroll" || activeNav === "fiyat") && hasPricing && (
        <section
          ref={(el) => {
            sectionElRefs.current.fiyat = el;
          }}
          className="px-4 py-16 sm:px-8 sm:py-20"
        >
          <div className="mx-auto max-w-3xl">
            <h2 className="font-display mb-8 text-2xl font-bold">{lang === "tr" ? "Paket ve Ücret" : "Package & Pricing"}</h2>
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
        </section>
      )}

      {/* Sözleşme + sonraki adımlar */}
      {(viewMode === "scroll" || activeNav === "sozlesme") && hasContract && (
        <section
          ref={(el) => {
            sectionElRefs.current.sozlesme = el;
          }}
          className="bg-muted/20 px-4 py-16 sm:px-8 sm:py-20"
        >
          <div className="mx-auto max-w-3xl space-y-10">
            <h2 className="font-display text-2xl font-bold">{lang === "tr" ? "Sözleşme" : "Contract"}</h2>

            {signableBlocks.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-primary">
                  {lang === "tr" ? "Sözleşme Koşulları" : "Contract Terms"}
                </p>
                <div className="space-y-2">
                  <BlockRenderer
                    blocks={signableBlocks}
                    ctx={{
                      title: proposal.title,
                      client: client.company || proposal.clients?.name || "",
                      value: proposal.value,
                      lineItems: items.map((li, i) => ({ id: String(i), name: li.name, unit: li.unit, qty: li.qty, optional: li.optional })),
                      lang,
                      getBlockSignState: signed ? undefined : getBlockSignState,
                    }}
                  />
                </div>
              </div>
            )}

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
        </section>
      )}

      {/* Onayla — imza */}
      {(viewMode === "scroll" || activeNav === "onayla") && (
      <section
        ref={(el) => {
          sectionElRefs.current.onayla = el;
        }}
        className="px-4 py-16 sm:px-8 sm:py-20"
      >
        <div className="glass-card mx-auto max-w-xl p-6 sm:p-8">
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
              <h2 className="font-display mb-4 text-xl font-bold">{lang === "tr" ? "Teklifi Onayla" : "Accept Proposal"}</h2>
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
              {pendingRequiredSignatures > 0 && (
                <p className="mb-3 text-xs text-muted-foreground">
                  {lang === "tr"
                    ? `Onaylamadan önce yukarıdaki ${pendingRequiredSignatures} sözleşme maddesini imzalaman gerekiyor.`
                    : `Sign the ${pendingRequiredSignatures} contract clause${pendingRequiredSignatures > 1 ? "s" : ""} above before you can accept.`}
                </p>
              )}
              <Button
                onClick={sign}
                disabled={signing || (requiresOtp && !otpSent) || pendingRequiredSignatures > 0}
                className="w-full gap-2"
                size="lg"
                style={accentColor ? { backgroundColor: accentColor, borderColor: accentColor } : undefined}
              >
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
      </section>
      )}

          <footer className="flex items-center justify-center gap-1.5 border-t border-border bg-muted/30 p-4 text-center text-xs text-muted-foreground">
            <CalendarClock className="h-3.5 w-3.5 shrink-0" />
            {lang === "tr"
              ? `${appConfig.name} — ${company?.name} · Bu teklif ${fmtDate(proposal.created_at, lang)} tarihinden itibaren ${proposal.valid_days} gün geçerlidir (${fmtDate(validUntil.toISOString(), lang)}'e kadar).`
              : `${appConfig.name} — ${company?.name} · This proposal is valid for ${proposal.valid_days} days from ${fmtDate(proposal.created_at, lang)} (until ${fmtDate(validUntil.toISOString(), lang)}).`}
          </footer>
        </main>
      </div>
    </div>
  );
}
