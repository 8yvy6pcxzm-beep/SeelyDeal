"use client";

import { useEffect, useRef, useState } from "react";
import { Download, FileText, Loader2, Plus, Star, Trash2, Upload, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLang } from "@/components/i18n/language-provider";
import { PersonalDefaultCard } from "@/components/app/personal-default-card";

type CompanyDocument = {
  id: string;
  type:
    | "contract"
    | "proposal_template"
    | "service_description"
    | "other"
    | "content_block"
    | "reference"
    | "company_material";
  title: string;
  content: string;
  is_default_template: boolean;
  file_path?: string | null;
  file_mime?: string | null;
  file_name?: string | null;
};

// The library exists mainly so a company can showcase its own example proposals, references,
// and general materials — "proposal_template" doubles as the AI's default-skeleton source
// (see makeDefaultTemplate). "contract"/"service_description" are kept selectable only so
// older rows created before this list changed still render a matching label.
const DOC_TYPES: { value: Exclude<CompanyDocument["type"], "content_block">; tr: string; en: string }[] = [
  { value: "proposal_template", tr: "Örnek teklif", en: "Example proposal" },
  { value: "reference", tr: "Referans / Vaka çalışması", en: "Reference / case study" },
  { value: "company_material", tr: "Şirket materyali", en: "Company material" },
  { value: "contract", tr: "Sözleşme", en: "Contract" },
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
      let { data: auth } = await supabase.auth.getUser();
      if (!auth.user) {
        // Client session may just be stale (expired access token not yet
        // refreshed) rather than an actual logged-out state — retry once
        // after a refresh before giving up (see company-profile-client.tsx).
        await supabase.auth.refreshSession();
        ({ data: auth } = await supabase.auth.getUser());
      }
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
  const selected = docs.find((d) => d.id === selectedId) ?? null;

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
      .insert({ company_id: companyId, type: "other", title: lang === "tr" ? "Yeni doküman" : "New document", content: "" })
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
                ? "Tekliflerinden kaydettiğin bloklar — \"sen hazırla\" dediğinde AI bunlardan yararlanır."
                : "Blocks you've saved from your proposals — the AI draws from these when you ask it to write the content itself."}
            </p>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
              {readyContent.map((d) => (
                <button
                  key={d.id}
                  onClick={() => setSelectedId(d.id)}
                  className="flex flex-col items-center gap-1.5 rounded-xl p-2 text-center transition-colors hover:bg-muted/50"
                >
                  <div className="grid h-16 w-16 place-items-center rounded-2xl bg-primary/10 text-primary">
                    <FileText className="h-6 w-6" />
                  </div>
                  <p className="line-clamp-2 text-xs font-medium">{d.title || (lang === "tr" ? "Başlıksız" : "Untitled")}</p>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>{lang === "tr" ? "Örnekleriniz ve Materyalleriniz" : "Your examples and materials"}</CardTitle>
            <p className="text-sm text-muted-foreground">
              {lang === "tr"
                ? "Kendi örnek tekliflerin, referansların/vaka çalışmaların ve genel şirket materyallerin. Bir \"örnek teklif\"i varsayılan yaparsan AI teklifleri o iskelete göre yazar."
                : "Your own example proposals, references/case studies, and general company materials. Mark an \"example proposal\" as default and the AI will follow its skeleton."}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.docx,.xlsx,.xls,.png,.jpg,.jpeg,.webp,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,image/png,image/jpeg,image/webp"
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
                onClick={() => setSelectedId(d.id)}
                className="flex flex-col items-center gap-1.5 rounded-xl p-2 text-center transition-colors hover:bg-muted/50"
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
        </CardContent>
      </Card>

      {selected && (
        <DocumentPreviewModal
          doc={selected}
          onClose={() => setSelectedId(null)}
          onChangeLocal={(patch) => setDocumentLocal(selected.id, patch)}
          onPersist={(patch) => persistDocument(selected.id, patch)}
          onMakeDefault={() => makeDefaultTemplate(selected.id)}
          onRemove={() => {
            removeDocument(selected.id);
          }}
        />
      )}
    </div>
  );
}

/** Full-screen preview of one library document: the real uploaded file (PDF renders
 * inline, DOCX offers a direct download since browsers can't render it natively) up
 * top, with title/type/AI-text editing tucked below as secondary, less prominent controls. */
function DocumentPreviewModal({
  doc,
  onClose,
  onChangeLocal,
  onPersist,
  onMakeDefault,
  onRemove,
}: {
  doc: CompanyDocument;
  onClose: () => void;
  onChangeLocal: (patch: Partial<CompanyDocument>) => void;
  onPersist: (patch: Partial<CompanyDocument>) => void;
  onMakeDefault: () => void;
  onRemove: () => void;
}) {
  const { lang } = useLang();
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [showText, setShowText] = useState(!doc.file_path);

  useEffect(() => {
    setPreviewUrl(null);
    setPreviewError(null);
    setShowText(!doc.file_path);
    if (!doc.file_path) return;
    setPreviewLoading(true);
    fetch(`/api/company-documents/${doc.id}/preview`)
      .then((res) => res.json())
      .then((data) => {
        if (data.error) setPreviewError(data.error);
        else setPreviewUrl(data.url);
      })
      .catch(() => setPreviewError(lang === "tr" ? "Önizleme yüklenemedi." : "Couldn't load preview."))
      .finally(() => setPreviewLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc.id, doc.file_path]);

  const isPdf = doc.file_mime === "application/pdf";
  const isImage = doc.file_mime?.startsWith("image/") ?? false;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="glass-card flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <Input
            className="h-9 flex-1 border-none px-0 text-[15px] font-semibold shadow-none focus-visible:ring-0"
            value={doc.title}
            onChange={(e) => onChangeLocal({ title: e.target.value })}
            onBlur={(e) => onPersist({ title: e.target.value })}
            placeholder={lang === "tr" ? "Başlık" : "Title"}
          />
          {previewUrl && (
            <a href={previewUrl} download={doc.file_name ?? undefined} className="ml-2 shrink-0">
              <Button variant="outline" size="icon" title={lang === "tr" ? "Orijinal dosyayı indir" : "Download original file"}>
                <Download className="h-4 w-4" />
              </Button>
            </a>
          )}
          <Button variant="outline" size="icon" onClick={onClose} className="ml-2 shrink-0">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="grid min-h-[300px] flex-1 place-items-center overflow-auto bg-muted/30">
          {doc.file_path ? (
            previewLoading ? (
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            ) : previewError ? (
              <p className="p-6 text-sm text-muted-foreground">{previewError}</p>
            ) : previewUrl && isPdf ? (
              <iframe src={previewUrl} title={doc.title} className="h-[60vh] w-full" />
            ) : previewUrl && isImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={previewUrl} alt={doc.title} className="max-h-[60vh] w-full object-contain" />
            ) : previewUrl ? (
              <div className="flex flex-col items-center gap-3 p-6 text-center">
                <FileText className="h-10 w-10 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  {lang === "tr"
                    ? "Bu dosya türü tarayıcıda görüntülenemiyor — orijinalini indirip açabilirsin."
                    : "This file type can't be previewed in the browser — download the original to open it."}
                </p>
                <a href={previewUrl} download={doc.file_name ?? undefined}>
                  <Button variant="outline" size="sm">
                    {lang === "tr" ? "Orijinal dosyayı indir" : "Download original file"}
                  </Button>
                </a>
              </div>
            ) : null
          ) : (
            <p className="p-6 text-sm text-muted-foreground">
              {lang === "tr" ? "Bu doküman için yüklenmiş bir dosya yok — sadece metin." : "No uploaded file for this document — text only."}
            </p>
          )}
        </div>

        <div className="space-y-2 border-t border-border px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            {doc.type === "content_block" ? (
              <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                {lang === "tr" ? "Hazır içerik" : "Ready-made content"}
              </span>
            ) : (
              <>
                <select
                  className={textareaClass("h-9 w-auto")}
                  value={doc.type}
                  onChange={(e) => {
                    const type = e.target.value as CompanyDocument["type"];
                    onChangeLocal({ type });
                    onPersist({ type });
                  }}
                >
                  {DOC_TYPES.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {lang === "tr" ? opt.tr : opt.en}
                    </option>
                  ))}
                </select>
                {doc.type === "proposal_template" &&
                  (doc.is_default_template ? (
                    <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                      {lang === "tr" ? "Varsayılan şablon" : "Default template"}
                    </span>
                  ) : (
                    <Button variant="outline" size="sm" onClick={onMakeDefault}>
                      {lang === "tr" ? "Varsayılan yap" : "Make default"}
                    </Button>
                  ))}
              </>
            )}
            <button
              type="button"
              className="ml-auto text-xs text-muted-foreground underline-offset-2 hover:underline"
              onClick={() => setShowText((v) => !v)}
            >
              {showText
                ? lang === "tr"
                  ? "AI metnini gizle"
                  : "Hide AI text"
                : lang === "tr"
                  ? "Seely'nin okuduğu metni göster/düzenle"
                  : "Show/edit the text Seely reads"}
            </button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => {
                onRemove();
                onClose();
              }}
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
          {showText && (
            <textarea
              className={textareaClass("min-h-32")}
              value={doc.content}
              onChange={(e) => onChangeLocal({ content: e.target.value })}
              onBlur={(e) => onPersist({ content: e.target.value })}
              placeholder={lang === "tr" ? "Metni buraya yapıştır…" : "Paste the text here…"}
            />
          )}
        </div>
      </div>
    </div>
  );
}
