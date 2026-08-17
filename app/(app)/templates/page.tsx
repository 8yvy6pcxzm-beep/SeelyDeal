"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useLang } from "@/components/i18n/language-provider";
import { templates as demoTemplates, type Template } from "@/lib/demo/data";
import { VisualTemplateCard } from "@/components/app/visual-template-card";
import { AiDraftDialog } from "@/components/app/ai-draft-dialog";
import { usePlan } from "@/components/app/plan-provider";
import { planAllows } from "@/lib/plan";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { TemplateHeader, type TemplateTab } from "./_components/template-header";
import { DraftTemplateCard } from "./_components/draft-template-card";
import { TemplatePreviewPanel } from "./_components/template-preview-panel";

type RealTemplateRow = {
  id: string;
  name: string;
  industry: string | null;
  sections: { title: string; body: string }[];
  line_items: unknown[];
  contract_text: string | null;
  intro_text: string | null;
  about_text: string | null;
  next_steps: unknown[];
  billing_options: unknown[];
  valid_days: number;
};

export default function TemplatesPage() {
  return (
    <Suspense fallback={null}>
      <TemplatesPageInner />
    </Suspense>
  );
}

function TemplatesPageInner() {
  const { t, lang } = useLang();
  const plan = usePlan();
  const searchParams = useSearchParams();
  const useParam = searchParams.get("use");
  const [realRows, setRealRows] = useState<RealTemplateRow[]>([]);
  const [aiOpen, setAiOpen] = useState(false);
  const [aiMode, setAiMode] = useState<"template" | "proposal">("template");
  const [aiTemplateId, setAiTemplateId] = useState<string | undefined>(undefined);
  const [savingDefault, setSavingDefault] = useState(false);
  const [tab, setTab] = useState<TemplateTab>("visual");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string | null>(null);

  // Serializes a draft example into the plain-text shape /api/settings/default-template
  // stores (app/api/draft-proposal/route.ts reads it back as VARSAYILAN TEKLİF ŞABLONU).
  async function saveAsDefault(tpl: Template) {
    setSavingDefault(true);
    try {
      const content = [
        tpl.introText ? t(tpl.introText) : null,
        ...tpl.sections.map((sec) => `${t(sec.title)}\n${t(sec.body)}`),
        tpl.contractText ? `${lang === "tr" ? "Sözleşme" : "Contract"}\n${t(tpl.contractText)}` : null,
      ]
        .filter(Boolean)
        .join("\n\n");
      await fetch("/api/settings/default-template", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
    } finally {
      setSavingDefault(false);
    }
  }

  async function loadReal() {
    try {
      const res = await fetch("/api/templates");
      const data = await res.json();
      setRealRows(data.templates ?? []);
    } catch {
      setRealRows([]);
    }
  }

  useEffect(() => {
    loadReal();
  }, []);

  const templates: Template[] = useMemo(
    () => [
      ...realRows.map((r) => ({
        id: r.id,
        name: { tr: r.name, en: r.name },
        category: { tr: r.industry || "Özel", en: r.industry || "Custom" },
        uses: 0,
        winRate: 0,
        accent: "var(--seg-1)",
        sections: r.sections.map((s) => ({ title: { tr: s.title, en: s.title }, body: { tr: s.body, en: s.body } })),
      })),
      ...demoTemplates,
    ],
    [realRows],
  );

  const [selected, setSelected] = useState(
    (useParam && templates.some((tpl) => tpl.id === useParam)) ? useParam : templates[0].id,
  );

  // Two separate galleries: "Görsel Şablonlar" (design-only skeletons — the AI only
  // ever takes their theme, never their text) and "Taslak Teklif Örnekleri" (real,
  // usable starting content — kind: "draft"). A category with multiple cards inside
  // one gallery (rare) renders as ONE card with a variant switcher.
  function groupByCategory(list: Template[]) {
    const byCategory = new Map<string, Template[]>();
    for (const tpl of list) {
      const key = tpl.category.tr;
      if (!byCategory.has(key)) byCategory.set(key, []);
      byCategory.get(key)!.push(tpl);
    }
    return Array.from(byCategory.values());
  }

  function matchesQuery(tpl: Template) {
    if (!query.trim()) return true;
    const q = query.trim().toLowerCase();
    return (
      t(tpl.name).toLowerCase().includes(q) ||
      t(tpl.category).toLowerCase().includes(q) ||
      (tpl.sector ?? "").toLowerCase().includes(q)
    );
  }

  const visualAll = useMemo(() => templates.filter((tpl) => tpl.kind !== "draft"), [templates]);
  const draftAll = useMemo(() => templates.filter((tpl) => tpl.kind === "draft"), [templates]);

  const activeCategories = useMemo(
    () => Array.from(new Set((tab === "visual" ? visualAll : draftAll).map((tpl) => t(tpl.category)))),
    [tab, visualAll, draftAll, t],
  );

  const visualGroups = useMemo(
    () => groupByCategory(visualAll.filter((tpl) => matchesQuery(tpl) && (!category || t(tpl.category) === category))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [visualAll, query, category, lang],
  );
  const draftGroups = useMemo(
    () => groupByCategory(draftAll.filter((tpl) => matchesQuery(tpl) && (!category || t(tpl.category) === category))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [draftAll, query, category, lang],
  );

  // Switching tabs (or typing a search that no longer matches the current selection's
  // category) shouldn't leave the preview panel stuck on a card from the other gallery —
  // derived directly instead of synced back into `selected` via an effect.
  const visibleFlat = tab === "visual" ? visualGroups.flat() : draftGroups.flat();
  const current =
    visibleFlat.find((tpl) => tpl.id === selected) ??
    visibleFlat[0] ??
    templates.find((tpl) => tpl.id === selected) ??
    templates[0];

  function changeTab(next: TemplateTab) {
    setTab(next);
    setCategory(null);
  }

  const canCreateTemplates = planAllows(plan, "templates_create");
  // Templates (visual/design starting points) are a Pro+ feature end to end — Lite
  // can't browse or use them either, not just create new ones. Lite customizes
  // brand color/logo only (see company-profile-client.tsx + the onboarding brand flow).
  const templatesAllowed = planAllows(plan, "templates_create");

  function draftFromCurrent() {
    // Open the AI chat right here, in-context, instead of routing away to /proposals —
    // the dialog already resolves templateId server-side and kicks off the first
    // message itself (see the initialTemplateId effect in ai-draft-dialog.tsx).
    setAiMode("proposal");
    setAiTemplateId(current.id);
    setAiOpen(true);
  }

  if (!templatesAllowed) {
    return (
      <div className="mx-auto max-w-[1100px]">
        <Card>
          <CardHeader>
            <CardTitle>{lang === "tr" ? "Şablonlar" : "Templates"}</CardTitle>
            <p className="text-sm text-muted-foreground">
              {lang === "tr"
                ? "Şablonlar Pro ve Custom paketlerinde kullanılabilir. Lite'ta marka rengini ve logonu Şirket Profili'nden özelleştirebilirsin — tekliflerin o marka kimliğiyle hazırlanır."
                : "Templates are available on the Pro and Custom plans. On Lite, customize your brand color and logo from Company Profile — proposals are drafted with that identity."}
            </p>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const groups = tab === "visual" ? visualGroups : draftGroups;

  return (
    <div className="mx-auto max-w-[1200px] animate-fade-in space-y-6">
      <TemplateHeader
        lang={lang}
        tab={tab}
        onTabChange={changeTab}
        visualCount={visualAll.length}
        draftCount={draftAll.length}
        query={query}
        onQueryChange={setQuery}
        category={category}
        onCategoryChange={setCategory}
        categories={activeCategories}
        canCreateTemplates={canCreateTemplates}
        onNewTemplate={() => {
          setAiMode("template");
          setAiTemplateId(undefined);
          setAiOpen(true);
        }}
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          {groups.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-muted/20 px-6 py-10 text-center text-sm text-muted-foreground">
              {lang === "tr" ? "Aramanla eşleşen şablon bulunamadı." : "No templates match your search."}
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {groups.map((group) =>
                tab === "visual" ? (
                  <VisualTemplateCard
                    key={group[0].category.tr}
                    group={group}
                    selected={selected}
                    lang={lang}
                    t={t}
                    onSelect={setSelected}
                  />
                ) : (
                  <DraftTemplateCard
                    key={group[0].category.tr}
                    group={group}
                    selected={selected}
                    lang={lang}
                    t={t}
                    onSelect={setSelected}
                  />
                ),
              )}
            </div>
          )}
        </div>

        <TemplatePreviewPanel
          current={current}
          lang={lang}
          t={t}
          savingDefault={savingDefault}
          onDraft={draftFromCurrent}
          onSaveAsDefault={() => saveAsDefault(current)}
        />
      </div>

      <AiDraftDialog
        open={aiOpen}
        onClose={() => {
          setAiOpen(false);
          setAiTemplateId(undefined);
        }}
        onSaved={loadReal}
        mode={aiMode}
        initialTemplateId={aiMode === "proposal" ? aiTemplateId : undefined}
      />
    </div>
  );
}
