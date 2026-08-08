"use client";

import { useEffect, useState } from "react";
import { Users, Loader2, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { useLang } from "@/components/i18n/language-provider";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

type Role = "owner" | "admin" | "member" | "viewer";
type Permissions = Record<string, boolean>;
type Member = { id: string; email: string | null; role: Role; permissions: Permissions; created_at: string };
type Invite = { id: string; email: string; role: Role; permissions: Permissions; created_at: string };

const AREAS = [
  { key: "proposals", tr: "Teklifler", en: "Proposals" },
  { key: "content", tr: "İçerik kütüphanesi", en: "Content library" },
  { key: "analytics", tr: "Analitik", en: "Analytics" },
  { key: "signatures", tr: "E-imza", en: "Signatures" },
  { key: "settings", tr: "Ayarlar", en: "Settings" },
] as const;

const ROLE_LABEL: Record<Role, { tr: string; en: string }> = {
  owner: { tr: "Sahip", en: "Owner" },
  admin: { tr: "Yönetici", en: "Admin" },
  member: { tr: "Üye", en: "Member" },
  viewer: { tr: "İzleyici", en: "Viewer" },
};

async function authHeader() {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return { Authorization: `Bearer ${session?.access_token}`, "Content-Type": "application/json" };
}

export function TeamRolesCard() {
  const { lang } = useLang();
  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<Role>("member");
  const [invitePerms, setInvitePerms] = useState<Permissions>({});
  const [inviting, setInviting] = useState(false);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/settings/team", { headers: await authHeader() });
    const data = await res.json();
    if (res.ok) {
      setMembers(data.members ?? []);
      setInvites(data.invites ?? []);
    } else {
      setError(data.error ?? null);
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function sendInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    setInviting(true);
    setError(null);
    const res = await fetch("/api/settings/team", {
      method: "POST",
      headers: await authHeader(),
      body: JSON.stringify({ email: inviteEmail, role: inviteRole, permissions: invitePerms }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error);
    } else {
      setInviteEmail("");
      setInviteRole("member");
      setInvitePerms({});
      await load();
    }
    setInviting(false);
  }

  async function updateRole(id: string, role: Role) {
    await fetch(`/api/settings/team/${id}`, { method: "PATCH", headers: await authHeader(), body: JSON.stringify({ role }) });
    await load();
  }

  async function togglePermission(id: string, area: string, current: Permissions) {
    const permissions = { ...current, [area]: !current[area] };
    await fetch(`/api/settings/team/${id}`, { method: "PATCH", headers: await authHeader(), body: JSON.stringify({ permissions }) });
    await load();
  }

  async function remove(id: string) {
    await fetch(`/api/settings/team/${id}`, { method: "DELETE", headers: await authHeader() });
    await load();
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-10 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-4 w-4 text-muted-foreground" />
          {lang === "tr" ? "Kullanıcı rolleri ve yetkilendirme" : "User roles and permissions"}
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          {lang === "tr"
            ? "Ekip üyelerinize özel roller atayın; hangi alanlara erişebileceklerini siz belirleyin."
            : "Assign custom roles to your teammates and control which areas each one can access."}
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="space-y-3">
          {members.map((m) => (
            <div key={m.id} className="rounded-lg border border-border p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{m.email ?? m.id}</p>
                </div>
                <div className="flex items-center gap-2">
                  {m.role === "owner" ? (
                    <Badge>{ROLE_LABEL.owner[lang]}</Badge>
                  ) : (
                    <select
                      value={m.role}
                      onChange={(e) => updateRole(m.id, e.target.value as Role)}
                      className="h-8 rounded-md border border-input bg-card px-2 text-xs"
                    >
                      {(["admin", "member", "viewer"] as const).map((r) => (
                        <option key={r} value={r}>
                          {ROLE_LABEL[r][lang]}
                        </option>
                      ))}
                    </select>
                  )}
                  {m.role !== "owner" && (
                    <button
                      onClick={() => remove(m.id)}
                      className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-destructive"
                      aria-label={lang === "tr" ? "Kaldır" : "Remove"}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
              {m.role !== "owner" && (
                <div className="mt-2 flex flex-wrap gap-3">
                  {AREAS.map((a) => (
                    <label key={a.key} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <input
                        type="checkbox"
                        checked={!!m.permissions[a.key]}
                        onChange={() => togglePermission(m.id, a.key, m.permissions)}
                        className="h-3.5 w-3.5 rounded border-input"
                      />
                      {a[lang]}
                    </label>
                  ))}
                </div>
              )}
            </div>
          ))}

          {invites.map((i) => (
            <div key={i.id} className="rounded-lg border border-dashed border-border p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{i.email}</p>
                  <p className="text-xs text-muted-foreground">
                    {lang === "tr" ? "Davet gönderildi, kabul bekleniyor" : "Invited, awaiting acceptance"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={i.role}
                    onChange={(e) => updateRole(i.id, e.target.value as Role)}
                    className="h-8 rounded-md border border-input bg-card px-2 text-xs"
                  >
                    {(["admin", "member", "viewer"] as const).map((r) => (
                      <option key={r} value={r}>
                        {ROLE_LABEL[r][lang]}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => remove(i.id)}
                    className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-destructive"
                    aria-label={lang === "tr" ? "Daveti iptal et" : "Revoke invite"}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        <form onSubmit={sendInvite} className="space-y-3 border-t border-border pt-4">
          <Label>{lang === "tr" ? "Ekibe davet et" : "Invite a teammate"}</Label>
          <div className="flex flex-wrap gap-2">
            <Input
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              type="email"
              placeholder="isim@sirket.com"
              className="max-w-xs flex-1"
            />
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as Role)}
              className="h-10 rounded-lg border border-input bg-card px-3 text-sm"
            >
              {(["admin", "member", "viewer"] as const).map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABEL[r][lang]}
                </option>
              ))}
            </select>
            <Button type="submit" disabled={inviting || !inviteEmail.trim()}>
              {inviting ? <Loader2 className="h-4 w-4 animate-spin" /> : lang === "tr" ? "Davet gönder" : "Send invite"}
            </Button>
          </div>
          <div className="flex flex-wrap gap-3">
            {AREAS.map((a) => (
              <label key={a.key} className={cn("flex items-center gap-1.5 text-xs text-muted-foreground")}>
                <input
                  type="checkbox"
                  checked={!!invitePerms[a.key]}
                  onChange={() => setInvitePerms((p) => ({ ...p, [a.key]: !p[a.key] }))}
                  className="h-3.5 w-3.5 rounded border-input"
                />
                {a[lang]}
              </label>
            ))}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
