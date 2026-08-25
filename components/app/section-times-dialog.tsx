"use client";

import { useEffect, useState } from "react";
import { X, Loader2, Clock } from "lucide-react";
import { useLang } from "@/components/i18n/language-provider";

type SectionTime = { title: string; seconds: number };

export function SectionTimesDialog({ proposalId, onClose }: { proposalId: string | null; onClose: () => void }) {
  const { lang } = useLang();
  const [loading, setLoading] = useState(false);
  const [sectionTimes, setSectionTimes] = useState<SectionTime[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!proposalId) return;
    setLoading(true);
    setError(null);
    fetch(`/api/proposals/${proposalId}/section-times`)
      .then((res) => res.json())
      .then((data) => {
        if (data.error) setError(data.error);
        else setSectionTimes(data.sectionTimes ?? []);
      })
      .catch(() => setError(lang === "tr" ? "Yüklenemedi." : "Couldn't load."))
      .finally(() => setLoading(false));
  }, [proposalId, lang]);

  if (!proposalId) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="glass-card w-full max-w-sm p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-[15px] font-semibold tracking-tight">
            {lang === "tr" ? "Bölüm başına görüntüleme süresi" : "Time spent per section"}
          </h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : sectionTimes.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {lang === "tr" ? "Henüz görüntüleme verisi yok." : "No view data yet."}
          </p>
        ) : (
          <div className="space-y-2">
            {sectionTimes.map((s, i) => (
              <div key={i} className="flex items-center justify-between rounded-lg border border-border p-2.5 text-[13px]">
                <span className="min-w-0 truncate font-medium">{s.title}</span>
                <span className="tnum inline-flex shrink-0 items-center gap-1 text-muted-foreground">
                  <Clock className="h-3.5 w-3.5" />
                  {s.seconds > 0 ? `${Math.round(s.seconds / 60) || 1}m` : "—"}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
