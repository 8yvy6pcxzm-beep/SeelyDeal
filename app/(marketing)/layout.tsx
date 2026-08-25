"use client";

import Link from "next/link";
import Script from "next/script";
import { AtSign } from "lucide-react";
import appConfig from "@/app.config";
import { Logo, LogoMark } from "@/components/ui/logo";
import { LanguageToggle } from "@/components/ui/language-toggle";
import { useLang } from "@/components/i18n/language-provider";

export default function MarketingLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const { ui, lang } = useLang();
  return (
    <div className="flex min-h-dvh flex-col overflow-x-clip">
      <header className="sticky top-0 z-30 border-b border-white/60 bg-white/70 shadow-[0_1px_0_rgba(15,23,42,0.03)] backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center px-5">
          <Link href="/">
            <Logo />
          </Link>
          <nav className="hidden flex-1 items-center justify-center gap-7 text-sm font-medium text-muted-foreground md:flex">
            <a href="#features" className="transition-colors hover:text-foreground">{ui.features}</a>
            <a href="#how" className="transition-colors hover:text-foreground">{ui.howItWorks}</a>
            <a href="#pricing" className="transition-colors hover:text-foreground">{ui.pricing}</a>
            <a href="#faq" className="transition-colors hover:text-foreground">{ui.faq}</a>
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <LanguageToggle className="mr-1" />
            <Link href="/login" className="hidden text-sm font-medium text-muted-foreground transition-colors hover:text-foreground sm:inline">
              {ui.signIn}
            </Link>
            <Link
              href="/signup"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[image:var(--grad-brand)] px-4 text-[13px] font-semibold text-primary-foreground shadow-[0_4px_16px_oklch(55%_0.2_290/0.25)] transition-all duration-150 hover:scale-[1.03] hover:shadow-[0_8px_22px_oklch(55%_0.2_290/0.38)]"
            >
              {ui.getStarted}
            </Link>
          </div>
        </div>
      </header>

      <div className="flex-1">{children}</div>

      <footer className="border-t border-border">
        <div className="mx-auto max-w-6xl px-5 py-12">
          <div className="flex flex-col gap-8 md:flex-row md:items-start md:justify-between">
            <div className="max-w-xs">
              <Logo />
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                {lang === "tr"
                  ? "AI ile yazılan, tek tıkla imzalanan teklifler. Güzel, etkileşimli, izlenebilir."
                  : "Proposals drafted by AI, signed in one click. Beautiful, interactive, trackable."}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-8 text-sm sm:grid-cols-3">
              <FooterCol
                title={lang === "tr" ? "Ürün" : "Product"}
                links={[lang === "tr" ? "Teklifler" : "Proposals", lang === "tr" ? "Şablonlar" : "Templates", lang === "tr" ? "Takip" : "Tracking", "E-sign"]}
              />
              <FooterCol
                title={lang === "tr" ? "Şirket" : "Company"}
                links={[lang === "tr" ? "Hakkımızda" : "About", lang === "tr" ? "Blog" : "Blog", lang === "tr" ? "Kariyer" : "Careers"]}
              />
              <FooterCol
                title={lang === "tr" ? "Yasal" : "Legal"}
                links={[
                  { label: lang === "tr" ? "Gizlilik" : "Privacy", href: "/privacy" },
                  { label: lang === "tr" ? "Şartlar" : "Terms", href: "/terms" },
                  { label: lang === "tr" ? "Güvenlik" : "Security" },
                ]}
              />
            </div>
          </div>
          <div className="mt-10 flex flex-col items-center gap-4 border-t border-border pt-6 sm:flex-row">
            <p className="text-xs text-muted-foreground">
              © {new Date().getFullYear()} {appConfig.name} · {appConfig.domain}
            </p>
            <div className="flex items-center gap-2 sm:ml-auto">
              <span className="grid h-8 w-8 place-items-center rounded-lg border border-border text-muted-foreground transition-colors hover:text-foreground">
                <AtSign className="h-4 w-4" />
              </span>
              <span className="grid h-8 w-8 place-items-center rounded-lg border border-border text-muted-foreground">
                <LogoMark className="h-4 w-4" />
              </span>
            </div>
          </div>
        </div>
      </footer>

      <Script src="/widget.js" strategy="lazyOnload" />
    </div>
  );
}

type FooterLink = string | { label: string; href?: string };

function FooterCol({ title, links }: { title: string; links: FooterLink[] }) {
  return (
    <div>
      <p className="label-mono text-muted-foreground">{title}</p>
      <ul className="mt-3 space-y-2">
        {links.map((l) => {
          const label = typeof l === "string" ? l : l.label;
          const href = typeof l === "string" ? undefined : l.href;
          return (
            <li key={label}>
              {href ? (
                <Link href={href} className="text-muted-foreground transition-colors hover:text-foreground">
                  {label}
                </Link>
              ) : (
                <span className="cursor-pointer text-muted-foreground transition-colors hover:text-foreground">{label}</span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
