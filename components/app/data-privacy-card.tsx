"use client";

import { useEffect, useState } from "react";
import { Download, Loader2, ShieldAlert, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useLang } from "@/components/i18n/language-provider";
import { createClient } from "@/lib/supabase/client";

async function authHeader() {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return { Authorization: `Bearer ${session?.access_token}` };
}

/** KVKK m.11 self-service: download everything we hold, or erase the account entirely. */
export function DataPrivacyCard() {
  const { lang } = useLang();
  const [isOwner, setIsOwner] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return;
      const { data: profile } = await supabase.from("profiles").select("role").eq("id", auth.user.id).maybeSingle();
      setIsOwner(profile?.role === "owner");
    })();
  }, []);

  async function exportData() {
    setExporting(true);
    const res = await fetch("/api/settings/export", { headers: await authHeader() });
    if (res.ok) {
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "seelydeal-veri-export.json";
      a.click();
      URL.revokeObjectURL(url);
    }
    setExporting(false);
  }

  async function deleteAccount() {
    setDeleting(true);
    setError(null);
    const res = await fetch("/api/settings/delete-account", { method: "POST", headers: await authHeader() });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error);
      setDeleting(false);
      return;
    }
    window.location.href = "/";
  }

  const confirmWord = lang === "tr" ? "SİL" : "DELETE";

  return (
    <Card>
      <CardHeader>
        <CardTitle>{lang === "tr" ? "Veri ve Gizlilik" : "Data & Privacy"}</CardTitle>
        <p className="text-sm text-muted-foreground">
          {lang === "tr"
            ? "KVKK kapsamındaki haklarını buradan kullanabilirsin: verilerini indir ya da hesabını kalıcı olarak sil."
            : "Exercise your data rights here: download everything we hold, or permanently delete your account."}
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between rounded-lg border border-border p-3">
          <div>
            <p className="text-sm font-medium">{lang === "tr" ? "Verilerimi indir" : "Download my data"}</p>
            <p className="text-xs text-muted-foreground">
              {lang === "tr" ? "Hesap, şirket, teklif ve doküman verilerin JSON olarak" : "Account, company, proposal and document data as JSON"}
            </p>
          </div>
          <Button variant="outline" size="sm" disabled={exporting} onClick={exportData} className="gap-2">
            {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            {lang === "tr" ? "İndir" : "Download"}
          </Button>
        </div>

        {isOwner && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
            <div className="flex items-start gap-2">
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-destructive">
                  {lang === "tr" ? "Hesabı ve şirketi kalıcı olarak sil" : "Permanently delete account and company"}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {lang === "tr"
                    ? "Şirketin tüm teklifleri, dokümanları, ekip üyeleri ve hesabın geri alınamaz şekilde silinir."
                    : "Deletes all of the company's proposals, documents, teammates, and your account — irreversible."}
                </p>

                {!confirmOpen ? (
                  <Button variant="destructive" size="sm" className="mt-3" onClick={() => setConfirmOpen(true)}>
                    <Trash2 className="mr-1.5 h-4 w-4" />
                    {lang === "tr" ? "Hesabı sil" : "Delete account"}
                  </Button>
                ) : (
                  <div className="mt-3 space-y-2">
                    <p className="text-xs text-muted-foreground">
                      {lang === "tr" ? `Onaylamak için "${confirmWord}" yaz:` : `Type "${confirmWord}" to confirm:`}
                    </p>
                    <input
                      value={confirmText}
                      onChange={(e) => setConfirmText(e.target.value)}
                      className="h-9 w-full max-w-xs rounded-md border border-input bg-card px-3 text-sm"
                      placeholder={confirmWord}
                    />
                    {error && <p className="text-sm text-destructive">{error}</p>}
                    <div className="flex gap-2">
                      <Button
                        variant="destructive"
                        size="sm"
                        disabled={confirmText !== confirmWord || deleting}
                        onClick={deleteAccount}
                      >
                        {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : (lang === "tr" ? "Kalıcı olarak sil" : "Permanently delete")}
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => setConfirmOpen(false)}>
                        {lang === "tr" ? "Vazgeç" : "Cancel"}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
