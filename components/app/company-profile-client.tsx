"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { useLang } from "@/components/i18n/language-provider";

type Company = {
  id: string;
  name: string;
  logo_url: string | null;
  primary_color: string | null;
  font: string | null;
  email: string | null;
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

      const [{ data: companyRow }, { data: teamRows }, { data: docRows }] = await Promise.all([
        supabase.from("companies").select("*").eq("id", profile.company_id).single(),
        supabase.from("team_members").select("*").eq("company_id", profile.company_id).order("created_at"),
        supabase.from("company_documents").select("*").eq("company_id", profile.company_id).order("created_at"),
      ]);

      setCompany(companyRow);
      setTeam(teamRows ?? []);
      setDocs(docRows ?? []);
      setLoading(false);
    })();
  }, []);

  async function saveCompany() {
    if (!company) return;
    setSaving(true);
    await supabase
      .from("companies")
      .update({
        name: company.name,
        logo_url: company.logo_url,
        primary_color: company.primary_color,
        font: company.font,
        email: company.email,
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

  async function updateTeamMember(id: string, patch: Partial<TeamMember>) {
    setTeam((t) => t.map((m) => (m.id === id ? { ...m, ...patch } : m)));
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

  async function updateDocument(id: string, patch: Partial<CompanyDocument>) {
    setDocs((d) => d.map((x) => (x.id === id ? { ...x, ...patch } : x)));
    await supabase.from("company_documents").update(patch).eq("id", id);
  }

  async function removeDocument(id: string) {
    setDocs((d) => d.filter((x) => x.id !== id));
    await supabase.from("company_documents").delete().eq("id", id);
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
            <Label>{lang === "tr" ? "Logo URL" : "Logo URL"}</Label>
            <Input
              value={company.logo_url ?? ""}
              onChange={(e) => setCompany({ ...company, logo_url: e.target.value })}
              placeholder="https://…/logo.png"
            />
          </div>
          <div className="space-y-1.5">
            <Label>{lang === "tr" ? "Ana renk (hex)" : "Primary color (hex)"}</Label>
            <Input
              value={company.primary_color ?? ""}
              onChange={(e) => setCompany({ ...company, primary_color: e.target.value })}
              placeholder="#7c5cf0"
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>{lang === "tr" ? "Yazı tipi" : "Font"}</Label>
            <Input value={company.font ?? ""} onChange={(e) => setCompany({ ...company, font: e.target.value })} placeholder="Inter" />
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
              <Input value={m.name} onChange={(e) => updateTeamMember(m.id, { name: e.target.value })} placeholder={lang === "tr" ? "İsim" : "Name"} />
              <Input value={m.title ?? ""} onChange={(e) => updateTeamMember(m.id, { title: e.target.value })} placeholder={lang === "tr" ? "Ünvan" : "Title"} />
              <Button variant="outline" size="icon" onClick={() => removeTeamMember(m.id)}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
              <Input
                className="sm:col-span-3"
                value={m.photo_url ?? ""}
                onChange={(e) => updateTeamMember(m.id, { photo_url: e.target.value })}
                placeholder={lang === "tr" ? "Fotoğraf URL" : "Photo URL"}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Documents */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>{lang === "tr" ? "Doküman kütüphanesi" : "Document library"}</CardTitle>
            <p className="text-sm text-muted-foreground">
              {lang === "tr"
                ? "Standart sözleşmen ve en çok kullandığın teklif formatları. AI ile teklif yazarken buradan revize edilebilir."
                : "Your standard contract and go-to proposal formats. The AI can revise these when drafting a proposal."}
            </p>
          </div>
          <Button variant="outline" onClick={addDocument} className="gap-1.5">
            <Plus className="h-4 w-4" />
            {lang === "tr" ? "Ekle" : "Add"}
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {docs.length === 0 && (
            <p className="text-sm text-muted-foreground">{lang === "tr" ? "Henüz doküman yok." : "No documents yet."}</p>
          )}
          {docs.map((d) => (
            <div key={d.id} className="space-y-2 rounded-lg border border-border p-3">
              <div className="flex flex-wrap items-center gap-2">
                <select
                  className={textareaClass("h-9 w-auto")}
                  value={d.type}
                  onChange={(e) => updateDocument(d.id, { type: e.target.value as CompanyDocument["type"] })}
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
                  onChange={(e) => updateDocument(d.id, { title: e.target.value })}
                  placeholder={lang === "tr" ? "Başlık" : "Title"}
                />
                <Button variant="outline" size="icon" onClick={() => removeDocument(d.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
              <textarea
                className={textareaClass("min-h-32")}
                value={d.content}
                onChange={(e) => updateDocument(d.id, { content: e.target.value })}
                placeholder={lang === "tr" ? "Metni buraya yapıştır…" : "Paste the text here…"}
              />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
