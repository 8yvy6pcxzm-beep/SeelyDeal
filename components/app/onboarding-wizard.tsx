"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Sparkles, Upload } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Logo } from "@/components/ui/logo";
import { useLang } from "@/components/i18n/language-provider";
import { cn } from "@/lib/utils";

type StepData = {
  name: string;
  yourName: string;
  yourTitle: string;
  website: string;
  email: string;
  address: string;
  phone: string;
  tagline: string;
  sector: string;
  companySize: string;
  primaryColor: string;
  logoBase64: string | null;
  logoMediaType: string | null;
  logoPreview: string | null;
  servicesSummary: string;
  aiInstructions: string;
};

const COLOR_PRESETS = ["#5B3DF6", "#7C3AED", "#0EA5A4", "#F97316", "#DB2777", "#111827"];

const SECTORS = [
  { key: "software", tr: "Yazılım / Teknoloji", en: "Software / Technology" },
  { key: "marketing", tr: "Ajans / Pazarlama", en: "Agency / Marketing" },
  { key: "consulting", tr: "Danışmanlık", en: "Consulting" },
  { key: "construction", tr: "İnşaat / Mimarlık", en: "Construction / Architecture" },
  { key: "creative", tr: "Tasarım / Yaratıcı Hizmetler", en: "Design / Creative Services" },
  { key: "other", tr: "Diğer", en: "Other" },
];

const SIZES = [
  { key: "solo", tr: "Sadece ben", en: "Just me", range: "1" },
  { key: "small", tr: "Küçük ekip", en: "Small team", range: "2-10" },
  { key: "medium", tr: "Orta ölçekli", en: "Medium-sized", range: "11-50" },
  { key: "large", tr: "Büyük ekip", en: "Large team", range: "50+" },
];

const SECTION_OPTIONS: { key: string; tr: string; en: string; core: boolean }[] = [
  { key: "intro", tr: "Ön Yazı", en: "Intro", core: true },
  { key: "about", tr: "Hakkımızda", en: "About Us", core: false },
  { key: "team", tr: "Ekibimiz", en: "Our Team", core: false },
  { key: "scope", tr: "Hizmet Kapsamı", en: "Scope", core: true },
  { key: "process", tr: "Süreç / Nasıl Çalışıyoruz", en: "Process", core: false },
  { key: "pricing", tr: "Paket ve Ücret", en: "Pricing", core: true },
  { key: "terms", tr: "Sözleşme Şartları", en: "Terms", core: false },
  { key: "next", tr: "Sonraki Adımlar", en: "Next Steps", core: true },
];

function fieldClass(hasError?: boolean) {
  return cn(
    "flex h-11 w-full rounded-xl border bg-card px-3.5 text-[14px] text-foreground placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-ring transition-colors",
    hasError ? "border-destructive" : "border-input",
  );
}

/** Full-screen, form-based onboarding wizard — replaces the old chat-driven
 * "İLK TANIŞMA AKIŞI" intro. Collects the same company-profile fields Seely
 * used to ask for in conversation, but as a short multi-step form (modeled
 * on a reference onboarding flow the user liked), then saves them through
 * the existing /api/settings/* endpoints and marks onboarding complete. */
export function OnboardingWizard({ initialName, userEmail }: { initialName: string; userEmail: string | null }) {
  const { lang, t } = useLang();
  const router = useRouter();
  const logoInputRef = useRef<HTMLInputElement>(null);

  const TOTAL_STEPS = 3;
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [logoUploading, setLogoUploading] = useState(false);

  const [data, setData] = useState<StepData>({
    name: initialName,
    yourName: "",
    yourTitle: "",
    website: "",
    email: "",
    address: "",
    phone: "",
    tagline: "",
    sector: "",
    companySize: "",
    primaryColor: "#5B3DF6",
    logoBase64: null,
    logoMediaType: null,
    logoPreview: null,
    servicesSummary: "",
    aiInstructions: "",
  });
  const [sections, setSections] = useState<Record<string, boolean>>(
    Object.fromEntries(SECTION_OPTIONS.map((s) => [s.key, s.core])),
  );
  const [sectionsPreset, setSectionsPreset] = useState<"all" | "lean" | null>("lean");

  function patch(next: Partial<StepData>) {
    setData((d) => ({ ...d, ...next }));
  }

  function applyPreset(preset: "all" | "lean") {
    setSectionsPreset(preset);
    setSections(Object.fromEntries(SECTION_OPTIONS.map((s) => [s.key, preset === "all" ? true : s.core])));
  }

  async function handleLogoFile(file: File) {
    setLogoUploading(true);
    setError(null);
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(",")[1] ?? "";
      patch({ logoBase64: base64, logoMediaType: file.type, logoPreview: result });
      setLogoUploading(false);
    };
    reader.onerror = () => {
      setError(lang === "tr" ? "Logo okunamadı." : "Couldn't read the logo file.");
      setLogoUploading(false);
    };
    reader.readAsDataURL(file);
  }

  function validateStep(): string | null {
    if (step === 1) {
      if (!data.name.trim()) return lang === "tr" ? "Şirket adı gerekli." : "Company name is required.";
    }
    return null;
  }

  function goNext() {
    const err = validateStep();
    if (err) {
      setError(err);
      return;
    }
    setError(null);
    setStep((s) => Math.min(TOTAL_STEPS, s + 1));
  }

  function goBack() {
    setError(null);
    setStep((s) => Math.max(1, s - 1));
  }

  async function finish() {
    setSaving(true);
    setError(null);
    try {
      const calls: Promise<Response>[] = [
        fetch("/api/settings/company-name", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: data.name.trim() }),
        }),
      ];

      if (data.email.trim()) {
        calls.push(
          fetch("/api/settings/email", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: data.email.trim() }),
          }),
        );
      }
      if (data.address.trim() || data.phone.trim()) {
        calls.push(
          fetch("/api/settings/contact-info", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ address: data.address.trim(), phone: data.phone.trim() }),
          }),
        );
      }
      if (data.tagline.trim()) {
        calls.push(
          fetch("/api/settings/tagline", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ tagline: data.tagline.trim() }),
          }),
        );
      }
      calls.push(
        fetch("/api/settings/brand-color", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ primaryColor: data.primaryColor }),
        }),
      );
      if (data.logoBase64 && data.logoMediaType) {
        calls.push(
          fetch("/api/settings/logo", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ mediaType: data.logoMediaType, base64: data.logoBase64 }),
          }),
        );
      }

      const metaLines: string[] = [];
      if (data.sector) {
        const s = SECTORS.find((s) => s.key === data.sector);
        if (s) metaLines.push(`${lang === "tr" ? "Sektör" : "Sector"}: ${t(s)}`);
      }
      if (data.companySize) {
        const sz = SIZES.find((s) => s.key === data.companySize);
        if (sz) metaLines.push(`${lang === "tr" ? "Şirket büyüklüğü" : "Company size"}: ${t(sz)}`);
      }
      if (data.website.trim()) metaLines.push(`${lang === "tr" ? "Web sitesi" : "Website"}: ${data.website.trim()}`);

      const servicesContent = [metaLines.join("\n"), data.servicesSummary.trim()].filter(Boolean).join("\n\n");
      if (servicesContent.trim()) {
        calls.push(
          fetch("/api/settings/service-description", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ content: servicesContent }),
          }),
        );
      }

      if (data.aiInstructions.trim()) {
        calls.push(
          fetch("/api/settings/ai-instructions", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ instruction: data.aiInstructions.trim() }),
          }),
        );
      }

      calls.push(
        fetch("/api/settings/default-sections", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sections }),
        }),
      );

      const results = await Promise.all(calls);
      const failed = results.find((r) => !r.ok);
      if (failed) {
        const body = await failed.json().catch(() => null);
        throw new Error(body?.error || (lang === "tr" ? "Bilgiler kaydedilirken bir sorun oluştu." : "Something went wrong saving your details."));
      }

      // No dedicated /api/settings/team endpoint for self-service add (that one's
      // Custom-plan-gated for roles/invites) — write directly via the browser
      // client, same pattern Company Profile uses, RLS-scoped to this company.
      if (data.yourName.trim()) {
        const supabase = createClient();
        const { data: auth } = await supabase.auth.getUser();
        if (auth.user) {
          const { data: profile } = await supabase.from("profiles").select("company_id").eq("id", auth.user.id).maybeSingle();
          if (profile) {
            const { data: existing } = await supabase
              .from("team_members")
              .select("id")
              .eq("company_id", profile.company_id)
              .eq("email", userEmail ?? auth.user.email)
              .maybeSingle();
            const patch = { name: data.yourName.trim(), title: data.yourTitle.trim() || null, email: userEmail ?? auth.user.email };
            if (existing) {
              await supabase.from("team_members").update(patch).eq("id", existing.id);
            } else {
              await supabase.from("team_members").insert({ company_id: profile.company_id, ...patch });
            }
          }
        }
      }

      const completeRes = await fetch("/api/settings/onboarding", { method: "POST" });
      if (!completeRes.ok) {
        const body = await completeRes.json().catch(() => null);
        throw new Error(body?.error || (lang === "tr" ? "Kurulum tamamlanamadı." : "Couldn't finish setup."));
      }

      router.push("/dashboard");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : lang === "tr" ? "Bir şeyler ters gitti." : "Something went wrong.");
      setSaving(false);
    }
  }

  return (
    <div className="grid min-h-dvh lg:grid-cols-[1fr_1.15fr]">
      {/* Left — value panel */}
      <section
        className="relative hidden flex-col justify-between overflow-hidden p-12 text-white lg:flex"
        style={{ backgroundImage: "var(--grad-brand)" }}
      >
        <span className="pointer-events-none absolute -right-16 -top-20 h-80 w-80 rounded-full bg-white/15 blur-3xl" />
        <span className="pointer-events-none absolute -bottom-16 -left-10 h-64 w-64 rounded-full bg-black/15 blur-3xl" />

        <Logo onDark />

        <div className="relative max-w-md">
          <p className="text-xs uppercase tracking-[0.22em] text-white/70">
            {lang === "tr" ? "Hoş geldin" : "Welcome"}
          </p>
          <h1 className="mt-3 font-display text-4xl font-semibold leading-tight">
            {lang === "tr" ? "Sadece birkaç adım uzaktasın." : "Just a few steps away."}
          </h1>
          <p className="mt-5 text-[15px] leading-relaxed text-white/85">
            {lang === "tr"
              ? "Şirket profilini kurduğunda Seely, her teklifi senin markanla ve hizmetlerinle otomatik hazırlar — bir daha bunları tek tek anlatmana gerek kalmaz."
              : "Once your company profile is set up, Seely drafts every proposal in your brand and with your services already baked in — no need to explain them again."}
          </p>

          <div className="mt-8 space-y-3">
            {(lang === "tr"
              ? ["Marka rengin ve logon her teklifte otomatik", "Hizmet ve fiyatlandırman hazır şablon olur", "Varsayılan bölümlerini bir kez seç, hep öyle kalsın"]
              : ["Your brand color and logo apply to every proposal", "Your services and pricing become a ready template", "Pick your default sections once, keep them forever"]
            ).map((line) => (
              <div key={line} className="flex items-center gap-2.5 text-[13.5px] text-white/90">
                <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-white/20">
                  <Check className="h-3 w-3" />
                </span>
                {line}
              </div>
            ))}
          </div>
        </div>

        <p className="relative text-xs text-white/65">
          {lang === "tr" ? "Kurulum yaklaşık 2 dakika sürer." : "Setup takes about 2 minutes."}
        </p>
      </section>

      {/* Right — form */}
      <section className="flex flex-col items-center justify-center px-6 py-10">
        <div className="w-full max-w-md">
          <div className="mb-5 inline-flex lg:hidden">
            <Logo />
          </div>
          <div className="mb-6 flex items-center gap-2">
            <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-primary">
              {lang === "tr" ? `Adım ${step} / ${TOTAL_STEPS}` : `Step ${step} of ${TOTAL_STEPS}`}
            </span>
          </div>

          <div className="mb-1.5 flex gap-1.5">
            {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
              <span
                key={i}
                className={cn(
                  "h-1.5 flex-1 rounded-full transition-colors",
                  i < step ? "bg-primary" : "bg-muted",
                )}
              />
            ))}
          </div>

          <div className="mt-6 rounded-2xl border border-border bg-card p-6 shadow-soft sm:p-7">
            {step === 1 && (
              <div className="space-y-5">
                <div>
                  <h2 className="font-display text-xl font-semibold tracking-tight">
                    {lang === "tr" ? "Şirketini tanıyalım" : "Let's get to know your company"}
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {lang === "tr"
                      ? "Bu bilgiler tekliflerinde ve antetli çıktılarında görünür."
                      : "This shows up on your proposals and letterhead-style output."}
                  </p>
                </div>

                <Field label={lang === "tr" ? "Şirket / marka adı" : "Company / brand name"} required>
                  <input
                    className={fieldClass()}
                    value={data.name}
                    onChange={(e) => patch({ name: e.target.value })}
                    placeholder={lang === "tr" ? "Örn. Acme Danışmanlık" : "e.g. Acme Consulting"}
                  />
                </Field>

                <div className="grid grid-cols-2 gap-3">
                  <Field label={lang === "tr" ? "Adın" : "Your name"}>
                    <input
                      className={fieldClass()}
                      value={data.yourName}
                      onChange={(e) => patch({ yourName: e.target.value })}
                      placeholder={lang === "tr" ? "Örn. Elif Akyüz" : "e.g. Jane Doe"}
                    />
                  </Field>
                  <Field label={lang === "tr" ? "Unvanın" : "Your title"}>
                    <input
                      className={fieldClass()}
                      value={data.yourTitle}
                      onChange={(e) => patch({ yourTitle: e.target.value })}
                      placeholder={lang === "tr" ? "Örn. Kurucu Ortak" : "e.g. Founder"}
                    />
                  </Field>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <Field label={lang === "tr" ? "Web sitesi" : "Website"}>
                    <input
                      className={fieldClass()}
                      value={data.website}
                      onChange={(e) => patch({ website: e.target.value })}
                      placeholder="acme.com"
                    />
                  </Field>
                  <Field label={lang === "tr" ? "İletişim e-postası" : "Contact email"}>
                    <input
                      type="email"
                      className={fieldClass()}
                      value={data.email}
                      onChange={(e) => patch({ email: e.target.value })}
                      placeholder="merhaba@acme.com"
                    />
                  </Field>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <Field label={lang === "tr" ? "Telefon" : "Phone"}>
                    <input
                      className={fieldClass()}
                      value={data.phone}
                      onChange={(e) => patch({ phone: e.target.value })}
                      placeholder="+90 5xx xxx xx xx"
                    />
                  </Field>
                  <Field label={lang === "tr" ? "Adres" : "Address"}>
                    <input
                      className={fieldClass()}
                      value={data.address}
                      onChange={(e) => patch({ address: e.target.value })}
                      placeholder={lang === "tr" ? "İl / ülke" : "City / country"}
                    />
                  </Field>
                </div>

                <Field label={lang === "tr" ? "Slogan (opsiyonel)" : "Tagline (optional)"}>
                  <input
                    className={fieldClass()}
                    value={data.tagline}
                    onChange={(e) => patch({ tagline: e.target.value })}
                    placeholder={lang === "tr" ? "Şirketini bir cümleyle özetle" : "Sum up your company in one line"}
                  />
                </Field>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-6">
                <div>
                  <h2 className="font-display text-xl font-semibold tracking-tight">
                    {lang === "tr" ? "Sektörün ve markan" : "Your sector and brand"}
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {lang === "tr"
                      ? "Sektörüne uygun taslak önerebilmemiz ve markanı her teklifte doğru göstermemiz için."
                      : "So we can suggest sector-fit templates and show your brand correctly on every proposal."}
                  </p>
                </div>

                <div>
                  <Label className="mb-2 block text-xs uppercase tracking-wide text-muted-foreground">
                    {lang === "tr" ? "Sektörünüz" : "Your sector"}
                  </Label>
                  <div className="grid grid-cols-2 gap-2">
                    {SECTORS.map((s) => (
                      <button
                        key={s.key}
                        type="button"
                        onClick={() => patch({ sector: s.key })}
                        className={cn(
                          "rounded-xl border px-3 py-2.5 text-left text-[13px] font-medium transition-colors",
                          data.sector === s.key
                            ? "border-primary bg-primary/5 text-primary ring-1 ring-primary/30"
                            : "border-border text-foreground hover:bg-muted",
                        )}
                      >
                        {t(s)}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <Label className="mb-2 block text-xs uppercase tracking-wide text-muted-foreground">
                    {lang === "tr" ? "Şirket büyüklüğü" : "Company size"}
                  </Label>
                  <div className="grid grid-cols-2 gap-2">
                    {SIZES.map((s) => (
                      <button
                        key={s.key}
                        type="button"
                        onClick={() => patch({ companySize: s.key })}
                        className={cn(
                          "rounded-xl border px-3 py-2.5 text-left transition-colors",
                          data.companySize === s.key
                            ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                            : "border-border hover:bg-muted",
                        )}
                      >
                        <p className="text-[13px] font-medium text-foreground">{t(s)}</p>
                        <p className="text-[11px] text-muted-foreground">{s.range} {lang === "tr" ? "kişi" : "people"}</p>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <Label className="mb-2 block text-xs uppercase tracking-wide text-muted-foreground">
                    {lang === "tr" ? "Marka rengi" : "Brand color"}
                  </Label>
                  <div className="flex flex-wrap items-center gap-2">
                    {COLOR_PRESETS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => patch({ primaryColor: c })}
                        className={cn(
                          "h-8 w-8 rounded-full border-2 transition-transform",
                          data.primaryColor.toLowerCase() === c.toLowerCase()
                            ? "scale-110 border-foreground"
                            : "border-transparent hover:scale-105",
                        )}
                        style={{ backgroundColor: c }}
                        aria-label={c}
                      />
                    ))}
                    <input
                      type="text"
                      value={data.primaryColor}
                      onChange={(e) => patch({ primaryColor: e.target.value })}
                      className="h-8 w-24 rounded-lg border border-input bg-card px-2 text-xs font-mono uppercase text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    />
                  </div>
                </div>

                <div>
                  <Label className="mb-2 block text-xs uppercase tracking-wide text-muted-foreground">
                    {lang === "tr" ? "Logo" : "Logo"}
                  </Label>
                  <div className="flex items-center gap-3">
                    <div className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-xl border border-border bg-muted">
                      {data.logoPreview ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={data.logoPreview} alt="" className="h-full w-full object-contain" />
                      ) : (
                        <Sparkles className="h-5 w-5 text-muted-foreground" />
                      )}
                    </div>
                    <input
                      ref={logoInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/svg+xml"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleLogoFile(file);
                      }}
                    />
                    <Button type="button" variant="outline" size="sm" onClick={() => logoInputRef.current?.click()} disabled={logoUploading}>
                      {logoUploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                      {lang === "tr" ? "Logo yükle" : "Upload logo"}
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-6">
                <div>
                  <h2 className="font-display text-xl font-semibold tracking-tight">
                    {lang === "tr" ? "Hizmetlerin ve teklif tercihlerin" : "Your services and proposal preferences"}
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {lang === "tr"
                      ? "Bunlar her yeni teklif taslağında otomatik kullanılır — sonradan Şirket Profili'nden düzenleyebilirsin."
                      : "These auto-apply to every new proposal draft — you can edit them later from Company Profile."}
                  </p>
                </div>

                <Field label={lang === "tr" ? "Hizmetlerin ve fiyatlandırma yaklaşımın (opsiyonel)" : "Your services and pricing approach (optional)"}>
                  <textarea
                    value={data.servicesSummary}
                    onChange={(e) => patch({ servicesSummary: e.target.value })}
                    rows={4}
                    className="flex w-full rounded-xl border border-input bg-card px-3.5 py-2.5 text-[14px] text-foreground placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-ring transition-colors"
                    placeholder={lang === "tr" ? "Örn. Web sitesi tasarımı: 2000$ sabit ücret\nAylık bakım: 200$/ay" : "e.g. Website design: $2,000 flat fee\nMonthly maintenance: $200/mo"}
                  />
                </Field>

                <Field label={lang === "tr" ? "Seely'nin ton/üslup talimatı (opsiyonel)" : "Tone/style instructions for Seely (optional)"}>
                  <textarea
                    value={data.aiInstructions}
                    onChange={(e) => patch({ aiInstructions: e.target.value })}
                    rows={2}
                    className="flex w-full rounded-xl border border-input bg-card px-3.5 py-2.5 text-[14px] text-foreground placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-ring transition-colors"
                    placeholder={lang === "tr" ? "Örn. Samimi ama profesyonel bir ton kullan, opsiyonel kalemleri hep işaretsiz bırak." : "e.g. Keep it warm but professional, leave optional line items unchecked by default."}
                  />
                </Field>

                <div>
                  <Label className="mb-2 block text-xs uppercase tracking-wide text-muted-foreground">
                    {lang === "tr" ? "Her teklifte varsayılan bölümler" : "Default sections on every proposal"}
                  </Label>
                  <div className="mb-2.5 flex gap-2">
                    <button
                      type="button"
                      onClick={() => applyPreset("all")}
                      className={cn(
                        "rounded-full border px-3 py-1 text-[12px] font-medium transition-colors",
                        sectionsPreset === "all" ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-muted",
                      )}
                    >
                      {lang === "tr" ? "Hepsi" : "All"}
                    </button>
                    <button
                      type="button"
                      onClick={() => applyPreset("lean")}
                      className={cn(
                        "rounded-full border px-3 py-1 text-[12px] font-medium transition-colors",
                        sectionsPreset === "lean" ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-muted",
                      )}
                    >
                      {lang === "tr" ? "Sade" : "Lean"}
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {SECTION_OPTIONS.map((opt) => (
                      <label
                        key={opt.key}
                        className={cn(
                          "flex cursor-pointer items-center gap-2 rounded-lg border px-2.5 py-2 text-[12.5px] transition-colors",
                          sections[opt.key] ? "border-primary/40 bg-primary/5 text-foreground" : "border-border text-muted-foreground hover:bg-muted",
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={!!sections[opt.key]}
                          onChange={(e) => {
                            setSectionsPreset(null);
                            setSections((s) => ({ ...s, [opt.key]: e.target.checked }));
                          }}
                          className="h-3.5 w-3.5 rounded border-input accent-primary"
                        />
                        {lang === "tr" ? opt.tr : opt.en}
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {error && (
              <p className="mt-4 rounded-lg bg-destructive/10 px-3 py-2 text-[13px] text-destructive">{error}</p>
            )}

            <div className="mt-7 flex items-center justify-between gap-3">
              {step > 1 ? (
                <Button type="button" variant="ghost" onClick={goBack} disabled={saving}>
                  {lang === "tr" ? "Geri" : "Back"}
                </Button>
              ) : (
                <span />
              )}
              {step < TOTAL_STEPS ? (
                <Button type="button" onClick={goNext} className="ml-auto">
                  {lang === "tr" ? "Devam et" : "Continue"}
                </Button>
              ) : (
                <Button type="button" onClick={finish} disabled={saving} className="ml-auto">
                  {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                  {lang === "tr" ? "Kurulumu tamamla" : "Complete setup"}
                </Button>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[13px]">
        {label}
        {required && <span className="ml-0.5 text-primary">*</span>}
      </Label>
      {children}
    </div>
  );
}
