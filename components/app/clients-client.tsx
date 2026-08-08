"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Loader2, Search, Trash2, FileText } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { useLang } from "@/components/i18n/language-provider";
import { formatUsd } from "@/lib/utils";
import { usePlan } from "@/components/app/plan-provider";

type Client = {
  id: string;
  name: string;
  email: string | null;
  website: string | null;
  created_at: string;
};

type ProposalSummary = {
  client_id: string | null;
  value: number | null;
  status: string;
  created_at: string;
};

export function ClientsClient() {
  const { lang } = useLang();
  const plan = usePlan();
  const canAddManually = plan !== "lite";
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [noCompany, setNoCompany] = useState(false);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [proposals, setProposals] = useState<ProposalSummary[]>([]);
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newClient, setNewClient] = useState({ name: "", email: "", website: "" });

  async function load() {
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
    const { data: profile } = await supabase.from("profiles").select("company_id").eq("id", auth.user.id).maybeSingle();
    if (!profile) {
      setNoCompany(true);
      setLoading(false);
      return;
    }
    setCompanyId(profile.company_id);

    const [{ data: clientRows }, { data: proposalRows }] = await Promise.all([
      supabase.from("clients").select("*").eq("company_id", profile.company_id).order("created_at", { ascending: false }),
      supabase.from("proposals").select("client_id, value, status, created_at").eq("company_id", profile.company_id),
    ]);

    setClients(clientRows ?? []);
    setProposals(proposalRows ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const stats = useMemo(() => {
    const byClient = new Map<string, { count: number; value: number; last: string | null }>();
    for (const p of proposals) {
      if (!p.client_id) continue;
      const entry = byClient.get(p.client_id) ?? { count: 0, value: 0, last: null };
      entry.count += 1;
      entry.value += Number(p.value) || 0;
      if (!entry.last || p.created_at > entry.last) entry.last = p.created_at;
      byClient.set(p.client_id, entry);
    }
    return byClient;
  }, [proposals]);

  const rows = useMemo(
    () => clients.filter((c) => !query || c.name.toLowerCase().includes(query.toLowerCase())),
    [clients, query],
  );

  async function addClient() {
    if (!companyId || !newClient.name.trim()) return;
    setSaving(true);
    const { data } = await supabase
      .from("clients")
      .insert({
        company_id: companyId,
        name: newClient.name.trim(),
        email: newClient.email.trim() || null,
        website: newClient.website.trim() || null,
      })
      .select("*")
      .single();
    if (data) setClients((c) => [data, ...c]);
    setNewClient({ name: "", email: "", website: "" });
    setAdding(false);
    setSaving(false);
  }

  async function removeClient(id: string) {
    setClients((c) => c.filter((x) => x.id !== id));
    await supabase.from("clients").delete().eq("id", id);
  }

  function fmtDate(iso: string | null) {
    if (!iso) return "—";
    const d = new Date(iso);
    return `${d.getUTCDate()} ${d.toLocaleString("en-US", { month: "short", timeZone: "UTC" })}`;
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

  if (noCompany) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          {lang === "tr"
            ? "Müşterileri görmek için gerçek bir hesapla kayıt olmalısın (demo modda bu sayfa çalışmaz)."
            : "Sign up with a real account to see clients (this page doesn't work in demo mode)."}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="mx-auto max-w-[1000px] animate-fade-in space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">{lang === "tr" ? "Müşteriler" : "Clients"}</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {lang === "tr"
              ? "Teklif gönderdiğin müşterilerin listesi. AI ile teklif oluşturunca buraya otomatik eklenirler."
              : "Everyone you've sent a proposal to. New clients are added automatically when you draft a proposal for them."}
          </p>
        </div>
        {canAddManually && (
          <Button onClick={() => setAdding((a) => !a)} className="ml-auto gap-1.5">
            <Plus className="h-4 w-4" />
            {lang === "tr" ? "Yeni müşteri" : "New client"}
          </Button>
        )}
      </div>

      {canAddManually && adding && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{lang === "tr" ? "Yeni müşteri ekle" : "Add a new client"}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label>{lang === "tr" ? "İsim" : "Name"}</Label>
              <Input value={newClient.name} onChange={(e) => setNewClient((c) => ({ ...c, name: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>{lang === "tr" ? "E-posta" : "Email"}</Label>
              <Input value={newClient.email} onChange={(e) => setNewClient((c) => ({ ...c, email: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>{lang === "tr" ? "Web sitesi" : "Website"}</Label>
              <Input value={newClient.website} onChange={(e) => setNewClient((c) => ({ ...c, website: e.target.value }))} />
            </div>
            <div className="flex gap-2 sm:col-span-3">
              <Button onClick={addClient} disabled={saving || !newClient.name.trim()} className="gap-2">
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                {lang === "tr" ? "Kaydet" : "Save"}
              </Button>
              <Button variant="outline" onClick={() => setAdding(false)}>
                {lang === "tr" ? "Vazgeç" : "Cancel"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={lang === "tr" ? "Müşteri ara…" : "Search clients…"}
          className="pl-9"
        />
      </div>

      <div className="overflow-hidden rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40 text-left text-xs font-medium text-muted-foreground">
              <th className="py-2.5 pl-4 pr-4">{lang === "tr" ? "Müşteri" : "Client"}</th>
              <th className="py-2.5 pr-4">{lang === "tr" ? "İletişim" : "Contact"}</th>
              <th className="py-2.5 pr-4 text-right">{lang === "tr" ? "Teklif" : "Proposals"}</th>
              <th className="py-2.5 pr-4 text-right">{lang === "tr" ? "Toplam değer" : "Total value"}</th>
              <th className="py-2.5 pr-4 text-right">{lang === "tr" ? "Son aktivite" : "Last activity"}</th>
              <th className="py-2.5 pr-4"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => {
              const s = stats.get(c.id);
              return (
                <tr key={c.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                  <td className="py-3 pl-4 pr-4 font-medium">{c.name}</td>
                  <td className="py-3 pr-4 text-muted-foreground">
                    {c.email || c.website || "—"}
                  </td>
                  <td className="py-3 pr-4 text-right tnum">
                    <span className="inline-flex items-center gap-1 justify-end">
                      <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                      {s?.count ?? 0}
                    </span>
                  </td>
                  <td className="py-3 pr-4 text-right tnum font-semibold">{formatUsd(s?.value ?? 0)}</td>
                  <td className="py-3 pr-4 text-right text-muted-foreground">{fmtDate(s?.last ?? null)}</td>
                  <td className="py-3 pr-4 text-right">
                    <button
                      onClick={() => removeClient(c.id)}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-destructive"
                      title={lang === "tr" ? "Sil" : "Delete"}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                  {lang === "tr" ? "Henüz müşteri yok." : "No clients yet."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
