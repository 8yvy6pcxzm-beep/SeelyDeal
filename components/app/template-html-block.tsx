"use client";

import { useMemo } from "react";
import DOMPurify from "dompurify";

/** Renders sanitized external HTML (e.g. a design exported from an outside tool) inside a template section. */
export function TemplateHtmlBlock({ html }: { html: string }) {
  const clean = useMemo(() => DOMPurify.sanitize(html), [html]);
  return <div className="template-html-block" dangerouslySetInnerHTML={{ __html: clean }} />;
}
