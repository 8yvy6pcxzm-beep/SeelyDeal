"use client";

import { useEffect, useRef, useState } from "react";
import { FileText, Loader2, Plus, Star, Trash2, Upload, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLang } from "@/components/i18n/language-provider";
import { PersonalDefaultCard } from "@/components/app/personal-default-card";

type CompanyDocument = {
  id: string;
  type: "contract" | "proposal_template" | "service_description" | "other" | "content_block";
  title: string;
  content: string;
  is_default_template: boolean;
};

const DOC_TYPES: { value: Exclude<CompanyDocument["type"], "content_block">; tr: string; en: string }[] = [
  { value: "contract", tr: "Sözleşme", en: "Contract" },
  { value: "proposal_template", tr: "Teklif formatı", en: "Proposal format" },
  { value: "service_description", tr: "Hizmet açıklaması", en: "Service description" },
  { value: "other", tr: "Diğer", en: "Other" },
];

function textareaClass(extra?: string) {
  return `flex w-full rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-ring transition-colors ${extra ?? ""}`;
}

/** iOS-homescreen-style grid of the company's proposal-library documents (see
 * app/(app)/content/page.tsx) — one rounded-square "app icon" per document,
 * name below, click to open/edit. Replaces the old always-expanded list that
 * lived inside Company Profile's "Varsayılan içerik" card. */
export function ContentLibraryClient() {
  const { lang } = useLang();
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [docs, setDocs] = useState<CompanyDocument[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) {
        setLoading(false);
        return;
      }
      const { data: profile } = await supabase.from("profiles").select("company_id").eq("id", auth.user.id).maybeSingle();
      if (!profile) {
        setLoading(false);
        return;
      }
      setCompanyId(profile.company_id);
      const { data: docRows } = await supabase
        .from("company_documents")
        .select("*")
        .eq("company_id", profile.company_id)
        .order("created_at");
      setDocs(docRows ?? []);
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ownDocs = docs.filter((d) => d.type !== "content_block");
  const readyContent = docs.filter((d) => d.type === "content_block");
  const selected = ownDocs.find((d) => d.id === selectedId) ?? null;

  function setDocumentLocal(id: string, patch: Partial<CompanyDocument>) {
    setDocs((d) => d.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  }

  async function persistDocument(id: string, patch: Partial<CompanyDocument>) {
    await supabase.from("company_documents").update(patch).eq("id", id);
  }

  async function addDocument() {
    if (!companyId) return;
    const { data } = await supabase
      .from("company_documents")
      .insert({ company_id: companyId, type: "contract", title: lang === "tr" ? "Yeni doküman" : "New document", content: "" })
      .select("*")
      .single();
    if (data) {
      setDocs((d) => [...d, data]);
      setSelectedId(data.id);
    }
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
      setSelectedId(data.document.id);
    } catch {
      setUploadError(lang === "tr" ? "Yüklenemedi." : "Upload failed.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function removeDocument(id: string) {
    setDocs((d) => d.filter((x) => x.id !== id));
    if (selectedId === id) setSelectedId(null);
    await supabase.from("company_documents").delete().eq("id", id);
  }

  async function makeDefaultTemplate(id: string) {
    setDocs((d) => d.map((x) => ({ ...x, is_default_template: x.type === "proposal_template" && x.id === id })));
    if (companyId) {
      await supabase.from("company_documents").update({ is_default_template: false }).eq("company_id", companyId).eq("type", "proposal_template");
    }
    await supabase.from("company_documents").update({ is_default_template: true }).eq("id", id);
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1100px] space-y-6">
      <PersonalDefaultCard />
      {readyContent.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{lang === "tr" ? "Hazır İçerikler" : "Ready-made content"}</CardTitle>
            <p className="text-sm text-muted-foreground">
              {lang === "tr"
                ? "SeelyDeal'ın önerdiği teklif içerikleri — \"sen hazırla\" dediğinde AI bunlardan yararlanır."
                : "SeelyDeal's suggested proposal content — the AI draws from these when you ask it to write the content itself."}
            </p>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
              {readyContent.map((d) => (
                <div key={d.id} className="flex flex-col items-center gap-1.5 text-center">
                  <div className="grid h-16 w-16 place-items-center rounded-2xl bg-primary/10 text-primary">
                    <FileText className="h-6 w-6" />
                  </div>
                  <p className="line-clamp-2 text-xs font-medium">{d.title}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>{lang === "tr" ? "Teklif Örnekleriniz" : "Your proposal examples"}</CardTitle>
            <p className="text-sm text-muted-foreground">
              {lang === "tr"
                ? "Kendi sözleşmen, teklif formatların ve hizmet açıklaman. Bir \"teklif formatı\"nı varsayılan yaparsan AI teklifleri o iskelete göre yazar."
                : "Your own contract, proposal formats, and service description. Mark a \"proposal format\" as default and the AI will follow its skeleton."}
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
          {ownDocs.length === 0 && (
            <p className="text-sm text-muted-foreground">{lang === "tr" ? "Henüz doküman yok." : "No documents yet."}</p>
          )}

          <div className="grid grid-cols-3 gap-4 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
            {ownDocs.map((d) => (
              <button
                key={d.id}
                onClick={() => setSelectedId(d.id === selectedId ? null : d.id)}
                className={`flex flex-col items-center gap-1.5 rounded-xl p-2 text-center transition-colors ${
                  selectedId === d.id ? "bg-muted" : "hover:bg-muted/50"
                }`}
              >
                <div className="relative grid h-16 w-16 place-items-center rounded-2xl bg-muted text-muted-foreground">
                  <FileText className="h-6 w-6" />
                  {d.is_default_template && (
                    <span className="absolute -right-1 -top-1 grid h-5 w-5 place-items-center rounded-full bg-primary text-primary-foreground">
                      <Star className="h-3 w-3 fill-current" />
                    </span>
                  )}
                </div>
                <p className="line-clamp-2 text-xs font-medium">{d.title || (lang === "tr" ? "Başlıksız" : "Untitled")}</p>
              </button>
            ))}
          </div>

          {selected && (
            <div className="space-y-2 rounded-lg border border-border p-3">
              <div className="flex flex-wrap items-center gap-2">
                <select
                  className={textareaClass("h-9 w-auto")}
                  value={selected.type === "content_block" ? "other" : selected.type}
                  onChange={(e) => {
                    const type = e.target.value as CompanyDocument["type"];
                    setDocumentLocal(selected.id, { type });
                    persistDocument(selected.id, { type });
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
                  value={selected.title}
                  onChange={(e) => setDocumentLocal(selected.id, { title: e.target.value })}
                  onBlur={(e) => persistDocument(selected.id, { title: e.target.value })}
                  placeholder={lang === "tr" ? "Başlık" : "Title"}
                />
                {selected.type === "proposal_template" &&
                  (selected.is_default_template ? (
                    <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                      {lang === "tr" ? "Varsayılan şablon" : "Default template"}
                    </span>
                  ) : (
                    <Button variant="outline" size="sm" onClick={() => makeDefaultTemplate(selected.id)}>
                      {lang === "tr" ? "Varsayılan yap" : "Make default"}
                    </Button>
                  ))}
                <Button variant="outline" size="icon" onClick={() => removeDocument(selected.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
                <Button variant="outline" size="icon" onClick={() => setSelectedId(null)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <textarea
                className={textareaClass("min-h-32")}
                value={selected.content}
                onChange={(e) => setDocumentLocal(selected.id, { content: e.target.value })}
                onBlur={(e) => persistDocument(selected.id, { content: e.target.value })}
                placeholder={lang === "tr" ? "Metni buraya yapıştır…" : "Paste the text here…"}
              />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
