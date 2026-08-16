// Mobile-viewport check for the AI draft dialog (components/app/ai-draft-dialog.tsx):
// its header close (X) button must stay reachable even when the dialog's
// content is tall, instead of rendering above the visible fold with no way
// to scroll up to it.
//
// Usage: npm run dev (separate terminal), then:
//   node scripts/draft-dialog-mobile-check.mjs
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
const email = profiles.find((p) => p.email && !p.email.startsWith("test-onboard"))?.email;
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
// iPhone-ish viewport with a short visible height, mimicking the address-bar-
// shown state on mobile Safari/Chrome where the bug reproduced.
const context = await browser.newContext({
  viewport: { width: 390, height: 560 },
  isMobile: true,
  hasTouch: true,
});
await context.addCookies([
  { name: `sb-${projectRef}-auth-token`, value: cookieValue, domain: "localhost", path: "/", httpOnly: false, secure: false, sameSite: "Lax" },
]);
const page = await context.newPage();
fs.mkdirSync("pw-shots", { recursive: true });

await page.goto("http://localhost:3000/proposals", { waitUntil: "domcontentloaded", timeout: 90000 });
await page.waitForTimeout(1500);
await page.screenshot({ path: "pw-shots/draft-dialog-00-list.png" });
console.log("All button labels:", await page.getByRole("button").allTextContents());

const draftBtn = page.getByRole("button", { name: /ai ile yaz/i }).first();
await draftBtn.click();
await page.waitForTimeout(800);
await page.screenshot({ path: "pw-shots/draft-dialog-01-open.png" });

const closeBtn = page.getByRole("button").filter({ has: page.locator("svg") }).first();
const headerCloseVisible = await page.locator('h3:has-text("teklif")').locator("xpath=../..").locator("button").last().isVisible().catch(() => false);
console.log("Header close button visible without scrolling:", headerCloseVisible);

// Force content to be tall: type a long message so the message column grows.
const textarea = page.locator("textarea");
await textarea.fill("Uzun bir mesaj ".repeat(20));
await page.waitForTimeout(300);
await page.screenshot({ path: "pw-shots/draft-dialog-02-tall-content.png" });

const dialogBox = await page.locator('h3:has-text("teklif")').locator("xpath=../../..").first().boundingBox();
console.log("Dialog bounding box (should start at y>=0, i.e. within viewport):", dialogBox);
console.log("Viewport height: 560");

await browser.close();
