// Headless visual/click smoke test for the block-rendering surfaces (Şablonlar
// page's Görsel/Taslak split, the "Bu taslağı varsayılan yap" flow, and the
// public/signing page's checklist section variant).
//
// Playwright's own Chromium build isn't published for this macOS version, so
// this launches the system's installed Google Chrome instead (see
// `executablePath` below — adjust it if Chrome lives somewhere else).
//
// Auth: rather than driving the real /login UI, this mints a magiclink for an
// existing account via the Supabase service role key, exchanges it for a
// session server-side, and injects that session directly as the same
// `sb-<project-ref>-auth-token` cookie @supabase/ssr's browser client would
// set — no password touched, nothing sent over email.
//
// Usage: npm run test:visual   (requires `npm run dev` already running on :3000)
import { createClient } from "@supabase/supabase-js";
import { chromium } from "@playwright/test";
import fs from "fs";

const env = Object.fromEntries(
  fs
    .readFileSync(".env.local", "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    }),
);

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const anon = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

const { data: profiles } = await admin.from("profiles").select("email").limit(20);
const email = profiles.find((p) => p.email?.startsWith("test-onboard"))?.email ?? profiles.find((p) => p.email)?.email;
if (!email) throw new Error("No account with an email found to test with.");
console.log("Using account:", email);

const { data: linkData, error } = await admin.auth.admin.generateLink({ type: "magiclink", email });
if (error) throw error;

const { data: verifyData, error: verifyErr } = await anon.auth.verifyOtp({ type: "email", token_hash: linkData.properties.hashed_token });
if (verifyErr) throw verifyErr;
const session = verifyData.session;

const projectRef = new URL(env.NEXT_PUBLIC_SUPABASE_URL).hostname.split(".")[0];
const cookieValue =
  "base64-" +
  Buffer.from(
    JSON.stringify({
      access_token: session.access_token,
      token_type: session.token_type,
      expires_in: session.expires_in,
      expires_at: session.expires_at,
      refresh_token: session.refresh_token,
      user: session.user,
    }),
  ).toString("base64");

const browser = await chromium.launch({
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: true,
});
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await context.addCookies([
  { name: `sb-${projectRef}-auth-token`, value: cookieValue, domain: "localhost", path: "/", httpOnly: false, secure: false, sameSite: "Lax" },
]);
const page = await context.newPage();

const consoleErrors = [];
page.on("console", (msg) => msg.type() === "error" && consoleErrors.push(msg.text()));
page.on("pageerror", (err) => consoleErrors.push("pageerror: " + err.message));

fs.mkdirSync("pw-shots", { recursive: true });

// 1) Şablonlar — Görsel Şablonlar / Taslak Teklif Örnekleri split.
await page.goto("http://localhost:3000/templates", { waitUntil: "load", timeout: 90000 });
await page.waitForTimeout(1200);
await page.screenshot({ path: "pw-shots/01-templates.png", fullPage: true });
console.log("Templates page h2 headings:", await page.locator("h2").allTextContents());

const consultingCard = page.getByText("Danışmanlık", { exact: true }).first();
if (await consultingCard.count()) {
  await consultingCard.click();
  await page.waitForTimeout(800);
  await page.screenshot({ path: "pw-shots/02-template-draft-detail.png", fullPage: true });
}
console.log("'Varsayılan yap' button visible:", (await page.getByRole("button", { name: /varsayılan yap/i }).count()) > 0);

// 2) Public/signing page — checklist section variant + view-time tracking wiring.
const { data: sampleProposal } = await admin.from("proposals").select("id").not("sections", "eq", "[]").limit(1).maybeSingle();
if (sampleProposal) {
  await page.goto(`http://localhost:3000/p/${sampleProposal.id}`, { waitUntil: "load", timeout: 60000 });
  await page.waitForSelector("aside nav button", { timeout: 20000 }).catch(() => console.log("nav didn't appear in time"));
  await page.waitForTimeout(1000);
  const kapsamNav = page.getByRole("button", { name: /kapsam/i }).first();
  if (await kapsamNav.count()) {
    await kapsamNav.click();
    await page.waitForTimeout(800);
    await page.screenshot({ path: "pw-shots/03-public-proposal-kapsam-checklist.png", fullPage: true });
  }
  console.log("data-section-index element count:", await page.locator("[data-section-index]").count());
}

console.log("\nConsole/page errors:", consoleErrors);
await browser.close();
