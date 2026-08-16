"use client";

import { useEffect, useRef, useState } from "react";
import { Plus, Trash2, Loader2, Upload } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { useLang } from "@/components/i18n/language-provider";
import appConfig, { aiOveragePack } from "@/app.config";
import { planAllows, type Plan } from "@/lib/plan";
import { PersonalDefaultCard } from "@/components/app/personal-default-card";
import { ColorSpectrumPicker } from "@/components/app/color-spectrum-picker";
import { extractDominantColor } from "@/lib/color";

type Company = {
  id: string;
  name: string;
  logo_url: string | null;
  cover_image_url: string | null;
  primary_color: string | null;
  font: string | null;
  email: string | null;
  address: string | null;
  phone: string | null;
  overage_link: string | null;
  ai_instructions: string | null;
  tagline: string | null;
  plan: Plan;
};

type TeamMember = {
  id: string;
  name: string;
  title: string | null;
  photo_url: string | null;
  email: string | null;
};

function textareaClass(extra?: string) {
  return `flex w-full rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-ring transition-colors ${extra ?? ""}`;
}

export function CompanyProfileClient() {
  const { lang, t } = useLang();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [noCompany, setNoCompany] = useState(false);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [company, setCompany] = useState<Company | null>(null);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [saving, setSaving] = useState(false);
  const [aiUsage, setAiUsage] = useState(0);
  const [crediting, setCrediting] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);
  const [colorTouchedByUser, setColorTouchedByUser] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [coverUploading, setCoverUploading] = useState(false);
  const [coverError, setCoverError] = useState<string | null>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const [photoUploadingId, setPhotoUploadingId] = useState<string | null>(null);
  const [photoErrorId, setPhotoErrorId] = useState<{ id: string; message: string } | null>(null);
  const photoInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const month = new Date().toISOString().slice(0, 7);

  useEffect(() => {
    (async () => {
      let { data: auth } = await supabase.auth.getUser();
      if (!auth.user) {
        // Client session may just be stale (expired access token not yet
        // refreshed) rather than an actual logged-out/demo state — retry
        // once after a refresh before concluding there's no real account.
        await supabase.auth.refreshSession();
        ({ data: auth } = await supabase.auth.getUser());
      }
      if (!auth.user) {
        setSessionExpired(true);
        setLoading(false);
        return;
      }
      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("id", auth.user.id)
        .maybeSingle();

      if (!profile) {
        setNoCompany(true);
        setLoading(false);
        return;
      }

      const [{ data: companyRow }, { data: teamRows }, { data: usageRow }] = await Promise.all([
        supabase.from("companies").select("*").eq("id", profile.company_id).single(),
        supabase.from("team_members").select("*").eq("company_id", profile.company_id).order("created_at"),
        supabase
          .from("ai_usage")
          .select("count")
          .eq("company_id", profile.company_id)
          .eq("month", new Date().toISOString().slice(0, 7))
          .maybeSingle(),
      ]);

      setCompany(companyRow);
      if (companyRow?.primary_color) setColorTouchedByUser(true);
      setTeam(teamRows ?? []);
      setAiUsage(usageRow?.count ?? 0);
      setLoading(false);
    })();
  }, []);

  async function creditOverage() {
    if (!company) return;
    setCrediting(true);
    const nextCount = Math.max(0, aiUsage - aiOveragePack[company.plan].extraDrafts);
    await supabase
      .from("ai_usage")
      .upsert({ company_id: company.id, month, count: nextCount }, { onConflict: "company_id,month" });
    setAiUsage(nextCount);
    setCrediting(false);
  }

  async function saveCompany() {
    if (!company) return;
    setSaving(true);
    await supabase
      .from("companies")
      .update({
        name: company.name,
        logo_url: company.logo_url,
        cover_image_url: company.cover_image_url,
        primary_color: company.primary_color,
        font: company.font,
        email: company.email,
        address: company.address,
        phone: company.phone,
        overage_link: company.overage_link,
        ai_instructions: company.ai_instructions,
        tagline: company.tagline,
      })
      .eq("id", company.id);
    setSaving(false);
  }

  async function addTeamMember() {
    if (!company) return;
    const { data } = await supabase
      .from("team_members")
      .insert({ company_id: company.id, name: lang === "tr" ? "Yeni kişi" : "New person" })
      .select("*")
      .single();
    if (data) setTeam((t) => [...t, data]);
  }

  function setTeamMemberLocal(id: string, patch: Partial<TeamMember>) {
    setTeam((t) => t.map((m) => (m.id === id ? { ...m, ...patch } : m)));
  }

  async function persistTeamMember(id: string, patch: Partial<TeamMember>) {
    await supabase.from("team_members").update(patch).eq("id", id);
  }

  async function removeTeamMember(id: string) {
    setTeam((t) => t.filter((m) => m.id !== id));
    await supabase.from("team_members").delete().eq("id", id);
  }

  async function uploadLogo(file: File) {
    setLogoError(null);
    setLogoUploading(true);
    try {
      const ACCEPTED = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];
      if (!ACCEPTED.includes(file.type)) {
        setLogoError(lang === "tr" ? "Sadece PNG, JPG, WEBP veya SVG." : "PNG, JPG, WEBP or SVG only.");
        return;
      }
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(",")[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const {
        data: { session },
      } = await supabase.auth.getSession();

      const res = await fetch("/api/settings/logo", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ mediaType: file.type, base64 }),
      });
      const data = await res.json();
      if (!res.ok) {
        setLogoError(data?.error || (lang === "tr" ? "Yüklenemedi." : "Upload failed."));
        return;
      }
      setCompany((c) => (c ? { ...c, logo_url: data.url } : c));
      if (!colorTouchedByUser) {
        extractDominantColor(data.url).then((hex) => {
          if (hex) setCompany((c) => (c ? { ...c, primary_color: hex } : c));
        });
      }
    } catch {
      setLogoError(lang === "tr" ? "Yüklenemedi." : "Upload failed.");
    } finally {
      setLogoUploading(false);
      if (logoInputRef.current) logoInputRef.current.value = "";
    }
  }

  async function uploadCoverImage(file: File) {
    setCoverError(null);
    setCoverUploading(true);
    try {
      const ACCEPTED = ["image/png", "image/jpeg", "image/webp"];
      if (!ACCEPTED.includes(file.type)) {
        setCoverError(lang === "tr" ? "Sadece PNG, JPG veya WEBP." : "PNG, JPG or WEBP only.");
        return;
      }
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(",")[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const {
        data: { session },
      } = await supabase.auth.getSession();

      const res = await fetch("/api/settings/cover-image", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ mediaType: file.type, base64 }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCoverError(data?.error || (lang === "tr" ? "Yüklenemedi." : "Upload failed."));
        return;
      }
      setCompany((c) => (c ? { ...c, cover_image_url: data.url } : c));
    } catch {
      setCoverError(lang === "tr" ? "Yüklenemedi." : "Upload failed.");
    } finally {
      setCoverUploading(false);
      if (coverInputRef.current) coverInputRef.current.value = "";
    }
  }

  async function uploadTeamPhoto(memberId: string, file: File) {
    setPhotoErrorId(null);
    setPhotoUploadingId(memberId);
    try {
      const ACCEPTED = ["image/png", "image/jpeg", "image/webp"];
      if (!ACCEPTED.includes(file.type)) {
        setPhotoErrorId({ id: memberId, message: lang === "tr" ? "Sadece PNG, JPG veya WEBP." : "PNG, JPG or WEBP only." });
        return;
      }
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(",")[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const {
        data: { session },
      } = await supabase.auth.getSession();

      const res = await fetch("/api/settings/team-photo", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ memberId, mediaType: file.type, base64 }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPhotoErrorId({ id: memberId, message: data?.error || (lang === "tr" ? "Yüklenemedi." : "Upload failed.") });
        return;
      }
      setTeamMemberLocal(memberId, { photo_url: data.url });
    } catch {
      setPhotoErrorId({ id: memberId, message: lang === "tr" ? "Yüklenemedi." : "Upload failed." });
    } finally {
      setPhotoUploadingId(null);
      const input = photoInputRefs.current[memberId];
      if (input) input.value = "";
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (sessionExpired) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          {lang === "tr"
            ? "Oturumun doğrulanamadı, sayfayı yenile ve tekrar dene."
            : "We couldn't verify your session — refresh the page and try again."}
        </CardContent>
      </Card>
    );
  }

  if (noCompany || !company) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          {lang === "tr"
            ? "Şirket profili görmek için gerçek bir hesapla kayıt olmalısın (demo modda bu sayfa çalışmaz)."
            : "Sign up with a real account to see your company profile (this page doesn't work in demo mode)."}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Personal default — only shown here for Lite, which has no content library page */}
      {!planAllows(company.plan, "document_library") && <PersonalDefaultCard />}
      {/* Brand */}
      <Card>
        <CardHeader>
          <CardTitle>{lang === "tr" ? "Marka" : "Brand"}</CardTitle>
          <p className="text-sm text-muted-foreground">
            {lang === "tr" ? "Tekliflerinde görünecek logo, renk ve iletişim bilgisi." : "The logo, color and contact info that show on your proposals."}
          </p>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>{lang === "tr" ? "Şirket adı" : "Company name"}</Label>
            <Input value={company.name} onChange={(e) => setCompany({ ...company, name: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>{lang === "tr" ? "E-posta" : "Email"}</Label>
            <Input value={company.email ?? ""} onChange={(e) => setCompany({ ...company, email: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>{lang === "tr" ? "Telefon" : "Phone"}</Label>
            <Input value={company.phone ?? ""} onChange={(e) => setCompany({ ...company, phone: e.target.value })} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>{lang === "tr" ? "Adres" : "Address"}</Label>
            <p className="text-xs text-muted-foreground">
              {lang === "tr"
                ? "Tekliflerde ve antetli sunumlarda \"Hizmeti Sunan\" tarafında görünür."
                : "Shows on the \"provided by\" side of proposals and letterhead-style exports."}
            </p>
            <Input value={company.address ?? ""} onChange={(e) => setCompany({ ...company, address: e.target.value })} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>{lang === "tr" ? "Slogan" : "Tagline"}</Label>
            <Input
              value={company.tagline ?? t(appConfig.tagline)}
              onChange={(e) => setCompany({ ...company, tagline: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>{lang === "tr" ? "Logo" : "Logo"}</Label>
            <div className="flex items-center gap-3">
              {company.logo_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={company.logo_url} alt="" className="h-9 w-9 rounded-md border border-border object-contain" />
              )}
              <input
                ref={logoInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                onChange={(e) => e.target.files?.[0] && uploadLogo(e.target.files[0])}
                className="hidden"
              />
              <Button variant="outline" onClick={() => logoInputRef.current?.click()} disabled={logoUploading} className="gap-1.5">
                {logoUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                {lang === "tr" ? "Logo yükle" : "Upload logo"}
              </Button>
            </div>
            {logoError && <p className="text-xs text-destructive">{logoError}</p>}
          </div>
          {planAllows(company.plan, "premium_design") && (
            <div className="space-y-1.5 sm:col-span-2">
              <Label>{lang === "tr" ? "Kapak görseli (Custom)" : "Cover image (Custom)"}</Label>
              <p className="text-xs text-muted-foreground">
                {lang === "tr"
                  ? "Teklif sayfasının kapağında düz renk yerine kendi görselini göster."
                  : "Show your own image on the proposal cover instead of the flat brand color."}
              </p>
              <div className="flex items-center gap-3">
                {company.cover_image_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={company.cover_image_url} alt="" className="h-9 w-16 rounded-md border border-border object-cover" />
                )}
                <input
                  ref={coverInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(e) => e.target.files?.[0] && uploadCoverImage(e.target.files[0])}
                  className="hidden"
                />
                <Button variant="outline" onClick={() => coverInputRef.current?.click()} disabled={coverUploading} className="gap-1.5">
                  {coverUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  {lang === "tr" ? "Kapak görseli yükle" : "Upload cover image"}
                </Button>
              </div>
              {coverError && <p className="text-xs text-destructive">{coverError}</p>}
            </div>
          )}
          <div className="space-y-1.5">
            <Label>{lang === "tr" ? "Ana renk (hex)" : "Primary color (hex)"}</Label>
            <div className="flex items-center gap-2">
              <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-md border border-border">
                <input
                  type="color"
                  value={/^#[0-9a-fA-F]{6}$/.test(company.primary_color ?? "") ? company.primary_color! : "#7c5cf0"}
                  onChange={(e) => {
                    setColorTouchedByUser(true);
                    setCompany({ ...company, primary_color: e.target.value });
                  }}
                  className="absolute -inset-2 h-[calc(100%+16px)] w-[calc(100%+16px)] cursor-pointer appearance-none border-0 bg-transparent p-0 [&::-moz-color-swatch]:border-0 [&::-webkit-color-swatch]:border-0 [&::-webkit-color-swatch-wrapper]:p-0"
                  aria-label={lang === "tr" ? "Renk seç" : "Pick color"}
                />
              </div>
              <Input
                value={company.primary_color ?? ""}
                onChange={(e) => {
                  setColorTouchedByUser(true);
                  setCompany({ ...company, primary_color: e.target.value });
                }}
                placeholder="#7c5cf0"
                className="flex-1"
              />
            </div>
            <ColorSpectrumPicker
              hex={/^#[0-9a-fA-F]{6}$/.test(company.primary_color ?? "") ? company.primary_color! : "#7c5cf0"}
              onChange={(hex) => {
                setColorTouchedByUser(true);
                setCompany({ ...company, primary_color: hex });
              }}
            />
            {company.logo_url && !colorTouchedByUser && (
              <p className="text-xs text-muted-foreground">
                {lang === "tr"
                  ? "Bu renk logonu tanıyarak önerildi — yukarıdan değiştirebilirsin."
                  : "This color was suggested from your logo — you can change it above."}
              </p>
            )}
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>{lang === "tr" ? "AI Talimatlarım" : "My AI instructions"}</Label>
            <textarea
              value={company.ai_instructions ?? ""}
              onChange={(e) => setCompany({ ...company, ai_instructions: e.target.value })}
              placeholder={
                lang === "tr"
                  ? "Örn: Opsiyonel kalemleri varsayılan olarak seçili bırakma. Ödeme linkini boş bırak, ben sonra eklerim."
                  : "E.g.: Leave optional items unchecked by default. Leave the payment link empty, I'll add it myself."
              }
              rows={3}
              className={textareaClass()}
            />
            <p className="text-xs text-muted-foreground">
              {lang === "tr"
                ? "Buraya yazdıkların her yeni AI teklif taslağında otomatik hatırlanır — aynı şeyi tekrar tekrar söylemene gerek kalmaz."
                : "Whatever you write here is remembered automatically in every new AI proposal draft — no need to repeat yourself."}
            </p>
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>{lang === "tr" ? "Aşım ödeme linki (Ruul)" : "Overage payment link (Ruul)"}</Label>
            <Input
              value={company.overage_link ?? ""}
              onChange={(e) => setCompany({ ...company, overage_link: e.target.value })}
              placeholder="https://ruul.io/…"
            />
            <p className="text-xs text-muted-foreground">
              {lang === "tr"
                ? "Aylık AI teklif hakkı dolduğunda kullanıcıya gösterilen ödeme linki."
                : "Shown to the user once their monthly AI draft quota runs out."}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-muted/30 p-3 sm:col-span-2">
            <p className="text-xs text-muted-foreground">
              {lang === "tr"
                ? `Bu ay kullanılan AI teklif sayısı: ${aiUsage}`
                : `AI drafts used this month: ${aiUsage}`}
            </p>
            <Button variant="outline" size="sm" onClick={creditOverage} disabled={crediting} className="ml-auto gap-1.5">
              {crediting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {lang === "tr"
                ? `Ödeme onaylandı — +${aiOveragePack[company.plan].extraDrafts} hak tanı`
                : `Payment confirmed — grant +${aiOveragePack[company.plan].extraDrafts}`}
            </Button>
          </div>
          <div className="sm:col-span-2">
            <Button onClick={saveCompany} disabled={saving} className="gap-2">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {lang === "tr" ? "Kaydet" : "Save"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Team */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>{lang === "tr" ? "Ekip" : "Team"}</CardTitle>
            <p className="text-sm text-muted-foreground">
              {lang === "tr" ? "Teklif hazırlayan ve imzalayan kişiler." : "People who prepare and sign proposals."}
            </p>
          </div>
          <Button variant="outline" onClick={addTeamMember} className="gap-1.5">
            <Plus className="h-4 w-4" />
            {lang === "tr" ? "Ekle" : "Add"}
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {team.length === 0 && (
            <p className="text-sm text-muted-foreground">{lang === "tr" ? "Henüz kimse eklenmedi." : "No one added yet."}</p>
          )}
          {team.map((m) => (
            <div key={m.id} className="grid grid-cols-1 gap-2 rounded-lg border border-border p-3 sm:grid-cols-[1fr_1fr_auto]">
              <Input
                value={m.name}
                onChange={(e) => setTeamMemberLocal(m.id, { name: e.target.value })}
                onBlur={(e) => persistTeamMember(m.id, { name: e.target.value })}
                placeholder={lang === "tr" ? "İsim" : "Name"}
              />
              <Input
                value={m.title ?? ""}
                onChange={(e) => setTeamMemberLocal(m.id, { title: e.target.value })}
                onBlur={(e) => persistTeamMember(m.id, { title: e.target.value })}
                placeholder={lang === "tr" ? "Ünvan" : "Title"}
              />
              <Button variant="outline" size="icon" onClick={() => removeTeamMember(m.id)}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
              <div className="flex items-center gap-3 sm:col-span-3">
                {m.photo_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={m.photo_url} alt="" className="h-9 w-9 rounded-full border border-border object-cover" />
                )}
                <input
                  ref={(el) => {
                    photoInputRefs.current[m.id] = el;
                  }}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(e) => e.target.files?.[0] && uploadTeamPhoto(m.id, e.target.files[0])}
                  className="hidden"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => photoInputRefs.current[m.id]?.click()}
                  disabled={photoUploadingId === m.id}
                  className="gap-1.5"
                >
                  {photoUploadingId === m.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  {lang === "tr" ? "Fotoğraf yükle" : "Upload photo"}
                </Button>
                {photoErrorId?.id === m.id && <p className="text-xs text-destructive">{photoErrorId.message}</p>}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Default content moved to the dedicated İçerik Kütüphanesi page (icon-grid UI) */}
      <Card>
        <CardHeader>
          <CardTitle>{lang === "tr" ? "Varsayılan içerik" : "Default content"}</CardTitle>
          <p className="text-sm text-muted-foreground">
            {lang === "tr"
              ? "Sözleşmen, teklif formatların, hizmet açıklaman ve teklif örneklerin artık İçerik Kütüphanesi'nde."
              : "Your contract, proposal formats, service description, and proposal examples now live in the Content Library."}
          </p>
        </CardHeader>
        <CardContent>
          <a href="/content">
            <Button variant="outline" className="gap-1.5">
              <Upload className="h-4 w-4" />
              {lang === "tr" ? "İçerik Kütüphanesi'ne git" : "Go to Content Library"}
            </Button>
          </a>
        </CardContent>
      </Card>
    </div>
  );
}
