"use client";

import { useEffect, useRef, useState } from "react";
import { Plus, Trash2, Loader2, Upload } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { useLang } from "@/components/i18n/language-provider";
import { aiOveragePack } from "@/app.config";
import { planAllows, type Plan } from "@/lib/plan";

type Company = {
  id: string;
  name: string;
  logo_url: string | null;
  cover_image_url: string | null;
  primary_color: string | null;
  font: string | null;
  email: string | null;
  overage_link: string | null;
  ai_instructions: string | null;
  plan: Plan;
};

type TeamMember = {
  id: string;
  name: string;
  title: string | null;
  photo_url: string | null;
  email: string | null;
};

type CompanyDocument = {
  id: string;
  type: "contract" | "proposal_template" | "service_description" | "other";
  title: string;
  content: string;
  is_default_template: boolean;
};

const DOC_TYPES: { value: CompanyDocument["type"]; tr: string; en: string }[] = [
  { value: "contract", tr: "Sözleşme", en: "Contract" },
  { value: "proposal_template", tr: "Teklif formatı", en: "Proposal format" },
  { value: "service_description", tr: "Hizmet açıklaması", en: "Service description" },
  { value: "other", tr: "Diğer", en: "Other" },
];

function textareaClass(extra?: string) {
  return `flex w-full rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-ring transition-colors ${extra ?? ""}`;
}

export function CompanyProfileClient() {
  const { lang } = useLang();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [noCompany, setNoCompany] = useState(false);
  const [company, setCompany] = useState<Company | null>(null);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [docs, setDocs] = useState<CompanyDocument[]>([]);
  const [saving, setSaving] = useState(false);
  const [aiUsage, setAiUsage] = useState(0);
  const [crediting, setCrediting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);
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
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) {
        setNoCompany(true);
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

      const [{ data: companyRow }, { data: teamRows }, { data: docRows }, { data: usageRow }] = await Promise.all([
        supabase.from("companies").select("*").eq("id", profile.company_id).single(),
        supabase.from("team_members").select("*").eq("company_id", profile.company_id).order("created_at"),
        supabase.from("company_documents").select("*").eq("company_id", profile.company_id).order("created_at"),
        supabase
          .from("ai_usage")
          .select("count")
          .eq("company_id", profile.company_id)
          .eq("month", new Date().toISOString().slice(0, 7))
          .maybeSingle(),
      ]);

      setCompany(companyRow);
      setTeam(teamRows ?? []);
      setDocs(docRows ?? []);
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
        overage_link: company.overage_link,
        ai_instructions: company.ai_instructions,
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

  async function addDocument() {
    if (!company) return;
    const { data } = await supabase
      .from("company_documents")
      .insert({
        company_id: company.id,
        type: "contract",
        title: lang === "tr" ? "Yeni doküman" : "New document",
        content: "",
      })
      .select("*")
      .single();
    if (data) setDocs((d) => [...d, data]);
  }

  async function uploadDocument(file: File) {
    setUploadError(null);
    setUploading(true);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(",")[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const {
        data: { session },
      } = await supabase.auth.getSession();

      const res = await fetch("/api/company-documents/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ fileName: file.name, mediaType: file.type, base64, title: file.name }),
      });
      const data = await res.json();
      if (!res.ok) {
        setUploadError(data?.error || (lang === "tr" ? "Yüklenemedi." : "Upload failed."));
        return;
      }
      setDocs((d) => [...d, data.document]);
    } catch {
      setUploadError(lang === "tr" ? "Yüklenemedi." : "Upload failed.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
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

  function setDocumentLocal(id: string, patch: Partial<CompanyDocument>) {
    setDocs((d) => d.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  }

  async function persistDocument(id: string, patch: Partial<CompanyDocument>) {
    await supabase.from("company_documents").update(patch).eq("id", id);
  }

  async function removeDocument(id: string) {
    setDocs((d) => d.filter((x) => x.id !== id));
    await supabase.from("company_documents").delete().eq("id", id);
  }

  async function makeDefaultTemplate(id: string) {
    if (!company) return;
    setDocs((d) => d.map((x) => ({ ...x, is_default_template: x.type === "proposal_template" && x.id === id })));
    await supabase
      .from("company_documents")
      .update({ is_default_template: false })
      .eq("company_id", company.id)
      .eq("type", "proposal_template");
    await supabase.from("company_documents").update({ is_default_template: true }).eq("id", id);
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
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
            <Input
              value={company.primary_color ?? ""}
              onChange={(e) => setCompany({ ...company, primary_color: e.target.value })}
              placeholder="#7c5cf0"
            />
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

      {/* Default content */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>{lang === "tr" ? "Varsayılan içerik" : "Default content"}</CardTitle>
            <p className="text-sm text-muted-foreground">
              {lang === "tr"
                ? "Standart sözleşmen ve en çok kullandığın teklif formatları. PDF/Word dosyanı yükleyebilir, birebir metnini buraya ekleyebilirsin. Bir \"teklif formatı\"nı varsayılan yaparsan AI teklifleri o iskelete göre yazar."
                : "Your standard contract and go-to proposal formats. Upload a PDF/Word file to add its exact text here. Mark a \"proposal format\" as default and the AI will follow its skeleton."}
            </p>
          </div>
          <div className="flex gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) uploadDocument(file);
              }}
            />
            <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={uploading} className="gap-1.5">
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {lang === "tr" ? "Dosyadan yükle" : "Upload file"}
            </Button>
            <Button variant="outline" onClick={addDocument} className="gap-1.5">
              <Plus className="h-4 w-4" />
              {lang === "tr" ? "Ekle" : "Add"}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {uploadError && <p className="text-sm text-destructive">{uploadError}</p>}
          {docs.length === 0 && (
            <p className="text-sm text-muted-foreground">{lang === "tr" ? "Henüz doküman yok." : "No documents yet."}</p>
          )}
          {docs.map((d) => (
            <div key={d.id} className="space-y-2 rounded-lg border border-border p-3">
              <div className="flex flex-wrap items-center gap-2">
                <select
                  className={textareaClass("h-9 w-auto")}
                  value={d.type}
                  onChange={(e) => {
                    const type = e.target.value as CompanyDocument["type"];
                    setDocumentLocal(d.id, { type });
                    persistDocument(d.id, { type });
                  }}
                >
                  {DOC_TYPES.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {lang === "tr" ? opt.tr : opt.en}
                    </option>
                  ))}
                </select>
                <Input
                  className="flex-1"
                  value={d.title}
                  onChange={(e) => setDocumentLocal(d.id, { title: e.target.value })}
                  onBlur={(e) => persistDocument(d.id, { title: e.target.value })}
                  placeholder={lang === "tr" ? "Başlık" : "Title"}
                />
                {d.type === "proposal_template" &&
                  (d.is_default_template ? (
                    <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                      {lang === "tr" ? "Varsayılan şablon" : "Default template"}
                    </span>
                  ) : (
                    <Button variant="outline" size="sm" onClick={() => makeDefaultTemplate(d.id)}>
                      {lang === "tr" ? "Varsayılan yap" : "Make default"}
                    </Button>
                  ))}
                <Button variant="outline" size="icon" onClick={() => removeDocument(d.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
              <textarea
                className={textareaClass("min-h-32")}
                value={d.content}
                onChange={(e) => setDocumentLocal(d.id, { content: e.target.value })}
                onBlur={(e) => persistDocument(d.id, { content: e.target.value })}
                placeholder={lang === "tr" ? "Metni buraya yapıştır…" : "Paste the text here…"}
              />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
