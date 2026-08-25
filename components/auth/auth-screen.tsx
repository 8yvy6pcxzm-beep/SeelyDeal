"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowRight, Loader2 } from "lucide-react";
import appConfig from "@/app.config";
import { useLang } from "@/components/i18n/language-provider";
import { Logo } from "@/components/ui/logo";
import { Label } from "@/components/ui/input";
import { LanguageToggle } from "@/components/ui/language-toggle";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

/** Glow-on-focus input — local to auth/onboarding, doesn't touch the shared <Input>. */
function GlowInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cn(
        "flex h-11 w-full rounded-xl border border-input bg-white/70 px-3.5 text-[14px] text-foreground placeholder:text-muted-foreground/60 backdrop-blur-sm transition-all duration-200",
        "focus-visible:outline-none focus-visible:border-primary/50 focus-visible:bg-white focus-visible:shadow-[0_0_0_4px_oklch(55%_0.2_280/0.12),0_8px_24px_oklch(55%_0.2_290/0.15)]",
        props.className,
      )}
    />
  );
}

function GlowButton({
  className,
  variant = "primary",
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "outline" }) {
  return (
    <motion.button
      whileHover={{ scale: 1.015 }}
      whileTap={{ scale: 0.985 }}
      transition={{ type: "spring", stiffness: 400, damping: 28 }}
      className={cn(
        "inline-flex h-11 items-center justify-center gap-2 rounded-xl text-sm font-medium transition-shadow duration-200 disabled:pointer-events-none disabled:opacity-50",
        variant === "primary"
          ? "bg-[image:var(--grad-brand)] text-white shadow-[0_8px_24px_oklch(55%_0.2_290/0.28)] hover:shadow-[0_10px_32px_oklch(55%_0.2_290/0.4)]"
          : "border border-border bg-white/70 text-foreground backdrop-blur-sm hover:border-primary/40 hover:bg-white hover:shadow-[0_6px_20px_oklch(55%_0.2_290/0.12)]",
        className,
      )}
      {...(props as any)}
    >
      {children}
    </motion.button>
  );
}

/**
 * Login / signup with real Supabase Auth, including Google/GitHub OAuth.
 */
export function AuthScreen({ mode }: { mode: "login" | "signup" }) {
  const { ui, t, lang } = useLang();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [lastUsed, setLastUsed] = useState<"google" | "github" | null>(null);
  const [consent, setConsent] = useState(false);
  const [consentHighlight, setConsentHighlight] = useState(false);
  const consentRef = useRef<HTMLLabelElement>(null);

  const isLogin = mode === "login";

  function flagMissingConsent() {
    setError(lang === "tr" ? "Devam etmek için aşağıdaki KVKK metnini onaylaman gerekiyor." : "You need to accept the privacy policy below to continue.");
    consentRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    setConsentHighlight(true);
    window.setTimeout(() => setConsentHighlight(false), 1600);
  }

  useEffect(() => {
    const stored = window.localStorage.getItem("seelydeal-last-auth-provider");
    if (stored === "google" || stored === "github") setLastUsed(stored);
  }, []);

  const [ssoDomain, setSsoDomain] = useState("");
  const [ssoOpen, setSsoOpen] = useState(false);

  async function signInWithSsoDomain(e: React.FormEvent) {
    e.preventDefault();
    if (!ssoDomain.trim()) return;
    setError(null);
    setLoading(true);
    const supabase = createClient();
    const { data, error: ssoError } = await supabase.auth.signInWithSSO({
      domain: ssoDomain.trim(),
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (ssoError) {
      setError(ssoError.message);
      setLoading(false);
      return;
    }
    if (data?.url) {
      window.location.href = data.url;
      return;
    }
    setError(
      lang === "tr"
        ? "Bu domain için henüz bir SSO sağlayıcısı bağlanmamış."
        : "No SSO provider is connected for this domain yet.",
    );
    setLoading(false);
  }

  async function signInWithProvider(provider: "google" | "github") {
    setError(null);
    setLoading(true);
    window.localStorage.setItem("seelydeal-last-auth-provider", provider);
    const supabase = createClient();
    const redirectTo = isLogin
      ? `${window.location.origin}/auth/callback`
      : `${window.location.origin}/auth/callback?consent=1`;
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo },
    });
    if (oauthError) {
      setError(oauthError.message);
      setLoading(false);
    }
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setLoading(true);

    const form = new FormData(e.currentTarget);
    const email = String(form.get("email") || "");
    const password = String(form.get("password") || "");
    const name = String(form.get("name") || "");

    const supabase = createClient();

    if (isLogin) {
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) {
        setError(signInError.message);
        setLoading(false);
        return;
      }

      // Covers accounts confirmed after signup (email confirmation required),
      // whose company/profile row was never created since signup returned no session.
      const completeRes = await fetch("/api/auth/complete-signup", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${signInData.session?.access_token}` },
        body: JSON.stringify({ email }),
      });

      if (!completeRes.ok) {
        const body = await completeRes.json().catch(() => null);
        setError(body?.error || (lang === "tr" ? "Hesap kurulumu tamamlanamadı." : "Couldn't finish setting up your account."));
        setLoading(false);
        return;
      }

      router.push("/dashboard");
      return;
    }

    if (!consent) {
      flagMissingConsent();
      setLoading(false);
      return;
    }

    const { data, error: signUpError } = await supabase.auth.signUp({ email, password });
    if (signUpError) {
      setError(signUpError.message);
      setLoading(false);
      return;
    }

    if (!data.session) {
      // Email confirmation is required before a session exists.
      setNotice(lang === "tr" ? "Hesabını onaylamak için e-postana gönderdiğimiz linke tıkla." : "Check your email to confirm your account.");
      setLoading(false);
      return;
    }

    const completeRes = await fetch("/api/auth/complete-signup", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session?.access_token}` },
      body: JSON.stringify({ email, companyName: name, consent: true }),
    });

    if (!completeRes.ok) {
      const body = await completeRes.json().catch(() => null);
      setError(body?.error || (lang === "tr" ? "Hesap oluşturulurken bir şeyler ters gitti." : "Something went wrong setting up your account."));
      setLoading(false);
      return;
    }

    router.push("/dashboard");
  }
  const stats = appConfig.marketing.stats.slice(0, 3);

  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.05fr_1fr]">
      {/* Left — brand panel */}
      <section
        className="relative hidden flex-col justify-between overflow-hidden p-12 text-white lg:flex"
        style={{ backgroundImage: "var(--grad-brand)" }}
      >
        <span className="pointer-events-none absolute -right-16 -top-20 h-80 w-80 rounded-full bg-white/15 blur-3xl" />
        <span className="pointer-events-none absolute -bottom-16 -left-10 h-64 w-64 rounded-full bg-black/15 blur-3xl" />

        <Link href="/" className="relative">
          <Logo onDark />
        </Link>

        <div className="relative max-w-md">
          <p className="text-xs uppercase tracking-[0.22em] text-white/70">
            {t(appConfig.marketing.badge)}
          </p>
          <h1 className="mt-3 font-display text-4xl font-semibold leading-tight">
            {t(appConfig.tagline)}
          </h1>
          <p className="mt-5 text-[15px] leading-relaxed text-white/85">{ui.authBlurb}</p>

          <div className="mt-8 grid grid-cols-3 gap-3">
            {stats.map((s) => (
              <div key={s.value} className="rounded-2xl bg-white/10 p-3 backdrop-blur-sm">
                <p className="font-display text-2xl font-semibold tabular-nums">{s.value}</p>
                <p className="mt-0.5 text-[11px] text-white/75">{t(s.label)}</p>
              </div>
            ))}
          </div>
        </div>

        <p className="relative text-xs text-white/65">
          © {appConfig.name} · {appConfig.domain}
        </p>
      </section>

      {/* Right — form */}
      <section
        className="relative flex flex-col items-center justify-center overflow-hidden px-6 py-12"
        style={{ backgroundImage: "var(--grad-mesh)" }}
      >
        <div className="absolute right-5 top-5 z-10">
          <LanguageToggle />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="relative w-full max-w-sm space-y-7 rounded-3xl border border-white/60 bg-white/70 p-7 shadow-[0_20px_60px_oklch(40%_0.04_285/0.10)] backdrop-blur-xl sm:p-8"
        >
          <Link href="/" className="inline-flex lg:hidden">
            <Logo />
          </Link>

          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
              {appConfig.name}
            </p>
            <h2 className="mt-1 font-display text-3xl font-semibold tracking-tight">
              {isLogin ? ui.welcomeBack : ui.createAccount}
            </h2>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="relative">
              {lastUsed === "google" && (
                <span className="absolute -top-2.5 right-3 rounded-full bg-[image:var(--grad-brand)] px-2 py-0.5 text-[10px] font-medium text-white shadow-sm shadow-primary/30">
                  {lang === "tr" ? "Son kullanılan" : "Last used"}
                </span>
              )}
              <GlowButton
                variant="outline"
                disabled={loading}
                onClick={() => signInWithProvider("google")}
                className={`w-full ${lastUsed === "google" ? "border-primary/40 ring-2 ring-primary/25" : ""}`}
              >
                <GoogleGlyph /> Google
              </GlowButton>
            </div>
            <div className="relative">
              {lastUsed === "github" && (
                <span className="absolute -top-2.5 right-3 rounded-full bg-[image:var(--grad-brand)] px-2 py-0.5 text-[10px] font-medium text-white shadow-sm shadow-primary/30">
                  {lang === "tr" ? "Son kullanılan" : "Last used"}
                </span>
              )}
              <GlowButton
                variant="outline"
                disabled={loading}
                onClick={() => signInWithProvider("github")}
                className={`w-full ${lastUsed === "github" ? "border-primary/40 ring-2 ring-primary/25" : ""}`}
              >
                <GithubGlyph /> GitHub
              </GlowButton>
            </div>
          </div>

          {!isLogin && (
            <p className="text-center text-[11px] leading-relaxed text-muted-foreground">
              {lang === "tr" ? (
                <>
                  Google veya GitHub ile devam ederek{" "}
                  <Link href="/privacy" target="_blank" className="underline underline-offset-2 hover:text-foreground">
                    KVKK Aydınlatma Metni ve Gizlilik Politikası
                  </Link>
                  'nı kabul etmiş olursun.
                </>
              ) : (
                <>
                  By continuing with Google or GitHub, you agree to our{" "}
                  <Link href="/privacy" target="_blank" className="underline underline-offset-2 hover:text-foreground">
                    Privacy Policy
                  </Link>
                  .
                </>
              )}
            </p>
          )}

          {isLogin &&
            (ssoOpen ? (
              <form onSubmit={signInWithSsoDomain} className="flex gap-2">
                <GlowInput
                  value={ssoDomain}
                  onChange={(e) => setSsoDomain(e.target.value)}
                  placeholder="sirket-domaini.com"
                  className="flex-1"
                />
                <GlowButton type="submit" variant="outline" disabled={loading || !ssoDomain.trim()} className="px-4">
                  {lang === "tr" ? "Devam et" : "Continue"}
                </GlowButton>
              </form>
            ) : (
              <button
                type="button"
                onClick={() => setSsoOpen(true)}
                className="text-center text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
              >
                {lang === "tr" ? "Kurumsal SSO ile giriş yap" : "Sign in with SSO"}
              </button>
            ))}

          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border" />
            {ui.orContinueWith} {ui.email.toLowerCase()}
            <span className="h-px flex-1 bg-border" />
          </div>

          <form onSubmit={submit} className="space-y-4">
            {!isLogin && (
              <div className="space-y-1.5">
                <Label htmlFor="name">{lang === "tr" ? "Şirket adı" : "Company name"}</Label>
                <GlowInput id="name" name="name" placeholder={lang === "tr" ? "İşletmenin adı" : "Your business name"} />
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="email">{ui.email}</Label>
              <GlowInput id="email" name="email" type="email" placeholder="you@company.com" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">{ui.password}</Label>
              <GlowInput id="password" name="password" type="password" placeholder="••••••••" required minLength={6} />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            {notice && <p className="text-sm text-success">{notice}</p>}
            {!isLogin && (
              <label
                ref={consentRef}
                className={`flex items-start gap-2 rounded-lg text-xs text-muted-foreground transition-all ${
                  consentHighlight ? "-mx-2 -my-1 animate-[shake_0.4s_ease-in-out] bg-destructive/10 px-2 py-1 ring-2 ring-destructive/60" : ""
                }`}
              >
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                  className="mt-0.5 h-3.5 w-3.5 shrink-0 rounded border-input"
                />
                <span>
                  {lang === "tr" ? (
                    <>
                      <Link href="/privacy" target="_blank" className="underline underline-offset-2 hover:text-foreground">
                        KVKK Aydınlatma Metni ve Gizlilik Politikası
                      </Link>
                      'nı okudum, kabul ediyorum.
                    </>
                  ) : (
                    <>
                      I have read and accept the{" "}
                      <Link href="/privacy" target="_blank" className="underline underline-offset-2 hover:text-foreground">
                        Privacy Policy
                      </Link>
                      .
                    </>
                  )}
                </span>
              </label>
            )}
            <GlowButton type="submit" disabled={loading} className="w-full">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {isLogin ? ui.signIn : ui.getStarted}
              {!loading && <ArrowRight className="h-4 w-4" />}
            </GlowButton>
          </form>

          <p className="text-center text-sm text-muted-foreground">
            {isLogin ? ui.noAccount : ui.haveAccount}{" "}
            <Link
              href={isLogin ? "/signup" : "/login"}
              className="font-medium text-primary hover:underline underline-offset-4"
            >
              {isLogin ? ui.getStarted : ui.signIn}
            </Link>
          </p>
        </motion.div>
      </section>
    </div>
  );
}

function GithubGlyph() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 2C6.48 2 2 6.48 2 12c0 4.42 2.87 8.17 6.84 9.5.5.09.66-.22.66-.48v-1.7c-2.78.6-3.37-1.34-3.37-1.34-.45-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.89 1.53 2.34 1.09 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.94 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.27.1-2.65 0 0 .84-.27 2.75 1.02a9.6 9.6 0 0 1 5 0c1.91-1.29 2.75-1.02 2.75-1.02.55 1.38.2 2.4.1 2.65.64.7 1.03 1.59 1.03 2.68 0 3.84-2.34 4.69-4.57 4.94.36.31.68.92.68 1.85v2.74c0 .27.16.58.67.48A10 10 0 0 0 22 12c0-5.52-4.48-10-10-10Z" />
    </svg>
  );
}

function GoogleGlyph() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1Z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.65l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z" />
      <path fill="#FBBC05" d="M5.84 14.11a6.6 6.6 0 0 1 0-4.22V7.05H2.18a11 11 0 0 0 0 9.9l3.66-2.84Z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.05l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38Z" />
    </svg>
  );
}
