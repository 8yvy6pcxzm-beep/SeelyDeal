"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { AiDraftDialog } from "@/components/app/ai-draft-dialog";

const AiDraftContext = createContext<(() => void) | null>(null);

/** Mounts a single shared AI-draft dialog + a global ⌘K/Ctrl+K shortcut; Topbar and Sidebar both open it through this. */
export function AiDraftProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(true);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <AiDraftContext.Provider value={() => setOpen(true)}>
      {children}
      <AiDraftDialog open={open} onClose={() => setOpen(false)} onSaved={() => {}} />
    </AiDraftContext.Provider>
  );
}

export function useOpenAiDraft() {
  const openAiDraft = useContext(AiDraftContext);
  if (!openAiDraft) throw new Error("useOpenAiDraft must be used inside <AiDraftProvider>");
  return openAiDraft;
}
