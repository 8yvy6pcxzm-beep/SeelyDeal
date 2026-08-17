// Quick headless check: open the AI draft dialog, send a weak prompt, verify
// the Clarifier chip UI renders, click a chip, verify it turns into a chat
// message. Reuses the magiclink-session-injection approach from visual-check.mjs.
import { createClient } from "@supabase/supabase-js";
import { chromium } from "@playwright/test";
import fs from "fs";

const env = Object.fromEntries(
  fs.readFileSync(".env.local", "utf8").split("\n").filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }),
);

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const anon = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
const email = "test-onboard-1786880769392@example.com";
const { data: linkData, error } = await admin.auth.admin.generateLink({ type: "magiclink", email });
if (error) throw error;
const { data: verifyData, error: verifyErr } = await anon.auth.verifyOtp({ type: "email", token_hash: linkData.properties.hashed_token });
if (verifyErr) throw verifyErr;
const session = verifyData.session;

const projectRef = new URL(env.NEXT_PUBLIC_SUPABASE_URL).hostname.split(".")[0];
const cookieValue = "base64-" + Buffer.from(JSON.stringify({
  access_token: session.access_token, token_type: session.token_type, expires_in: session.expires_in,
  expires_at: session.expires_at, refresh_token: session.refresh_token, user: session.user,
})).toString("base64");

const browser = await chromium.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await context.addCookies([{ name: `sb-${projectRef}-auth-token`, value: cookieValue, domain: "localhost", path: "/", httpOnly: false, secure: false, sameSite: "Lax" }]);
const page = await context.newPage();
const consoleErrors = [];
page.on("console", (msg) => msg.type() === "error" && consoleErrors.push(msg.text()));
page.on("pageerror", (err) => consoleErrors.push("pageerror: " + err.message));

fs.mkdirSync("pw-shots", { recursive: true });

await page.goto("http://localhost:3000/proposals", { waitUntil: "load", timeout: 90000 });
await page.waitForTimeout(1500);
console.log("URL after goto:", page.url());
await page.screenshot({ path: "pw-shots/clarify-00-debug.png", fullPage: true });
console.log("Buttons on page:", await page.locator("button").allTextContents());

await page.getByRole("button", { name: /^(AI ile yaz|Yeni teklif)$/i }).first().click();
await page.waitForTimeout(800);
await page.screenshot({ path: "pw-shots/clarify-01-dialog-open.png" });

const textarea = page.locator("textarea, input[type=text]").last();
await textarea.fill("teklif yaz");
await page.keyboard.press("Enter");

console.log("Waiting for clarify chips...");
await page.waitForSelector("text=Hangi hizmeti teklif ediyorsun?", { timeout: 30000 }).catch((e) => console.log("clarify question not found:", e.message));
await page.waitForTimeout(500);
await page.screenshot({ path: "pw-shots/clarify-02-chips-visible.png" });

const chipButton = page.getByRole("button", { name: "Web sitesi tasarımı" });
const chipVisible = await chipButton.count();
console.log("Chip button found:", chipVisible > 0);

if (chipVisible > 0) {
  await chipButton.click();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: "pw-shots/clarify-03-after-chip-click.png" });
  const userBubbleText = await page.locator("text=Web sitesi tasarımı").allTextContents();
  console.log("Text 'Web sitesi tasarımı' now appears", userBubbleText.length, "time(s) on page (expect chat bubble + maybe nothing else since chips clear).");
}

console.log("\nConsole/page errors:", consoleErrors);
await browser.close();
