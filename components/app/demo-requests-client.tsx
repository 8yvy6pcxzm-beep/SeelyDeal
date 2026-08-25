"use client";

import { useEffect, useState } from "react";
import { Loader2, Mail, Building2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useLang } from "@/components/i18n/language-provider";

type DemoRequest = {
  id: string;
  name: string;
  email: string;
  company: string | null;
  message: string | null;
  tier: string | null;
  created_at: string;
};

export function DemoRequestsClient() {
  const { lang } = useLang();
  const supabase = createClient();
  const [requests, setRequests] = useState<DemoRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);

  useEffect(() => {
    (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const res = await fetch("/api/demo-requests", {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (res.status === 403) {
        setForbidden(true);
        setLoading(false);
        return;
      }
      const data = await res.json();
      setRequests(data.requests ?? []);
      setLoading(false);
    })();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (forbidden) {
    return (
      <div className="mx-auto max-w-[1100px] rounded-2xl border border-border bg-card p-10 text-center text-sm text-muted-foreground">
        {lang === "tr" ? "Bu sayfayı görmeye yetkin yok." : "You don't have access to this page."}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1100px] animate-fade-in space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight">{lang === "tr" ? "Demo talepleri" : "Demo requests"}</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {lang === "tr" ? "Growth/Scale planları için gelen demo talepleri." : "Inbound demo requests for Growth/Scale plans."}
        </p>
      </div>

      {requests.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-10 text-center text-sm text-muted-foreground">
          {lang === "tr" ? "Henüz demo talebi yok." : "No demo requests yet."}
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map((r) => (
            <div key={r.id} className="glass-card p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-medium">{r.name}</p>
                  <div className="mt-0.5 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Mail className="h-3.5 w-3.5" />
                      {r.email}
                    </span>
                    {r.company && (
                      <span className="flex items-center gap-1">
                        <Building2 className="h-3.5 w-3.5" />
                        {r.company}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {r.tier && (
                    <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">{r.tier}</span>
                  )}
                  <span className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleDateString(lang === "tr" ? "tr-TR" : "en-US")}</span>
                </div>
              </div>
              {r.message && <p className="mt-2 text-sm text-muted-foreground">{r.message}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
