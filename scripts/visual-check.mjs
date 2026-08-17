// Headless visual/click smoke test for the block-rendering surfaces (Şablonlar
// page's Görsel/Taslak split, the "Bu taslağı varsayılan yap" flow, the public/
// signing page's checklist section variant, and the AI draft-from-template flow).
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

// Prefer an account whose company already finished onboarding — otherwise every
// route redirects to the "Şirketini tanıyalım" onboarding screen instead of
// the page under test.
const { data: onboardedCompanies } = await admin.from("companies").select("id,plan").eq("onboarding_completed", true);
const { data: profiles } = await admin
  .from("profiles")
  .select("email,company_id")
  .in("company_id", (onboardedCompanies ?? []).map((c) => c.id))
  .not("email", "is", null);
const testProfile = profiles.find((p) => p.email?.startsWith("test-onboard")) ?? profiles[0];
if (!testProfile) throw new Error("No onboarded account with an email found to test with.");
const email = testProfile.email;
console.log("Using account:", email);

// Templates are Pro+ only (planAllows "templates_create") — bump this test
// account's company to "pro" if it isn't already, so /templates renders
// instead of the upsell card. ALWAYS reverted in `finally` below, even if a
// later step throws.
const company = onboardedCompanies.find((c) => c.id === testProfile.company_id);
let bumpedCompanyId = null;
const originalPlan = company?.plan;
if (company && company.plan !== "pro" && company.plan !== "custom") {
  await admin.from("companies").update({ plan: "pro" }).eq("id", company.id);
  bumpedCompanyId = company.id;
  console.log(`Temporarily bumped company ${company.id} from "${originalPlan}" to "pro" for this test run.`);
}

try {
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
  console.log('"Tasarım / Tema" badge count (visual cards):', await page.getByText("Tasarım / Tema", { exact: true }).count());

  const consultingCard = page.getByText("Danışmanlık", { exact: true }).first();
  if (await consultingCard.count()) {
    await consultingCard.click();
    await page.waitForTimeout(800);
    await page.screenshot({ path: "pw-shots/02-template-draft-detail.png", fullPage: true });
  }
  console.log("'Varsayılan yap' button visible:", (await page.getByRole("button", { name: /varsayılan yap/i }).count()) > 0);

  // 2) AI draft flow — send a chat message with the "Tadilat" (construction, kind:"draft")
  // sector template's id as templateId, same as clicking that sector chip in
  // AiDraftDialog, and check the model's system-prompt-driven reply actually
  // reflects the template's real content (not a "sadece görsel" refusal).
  const constructionTemplateId = "t5"; // lib/demo/data.ts — sector: "construction", kind: "draft"
  const chatResp = await page.request.post("http://localhost:3000/api/draft-proposal", {
    data: {
      messages: [{ role: "user", content: "Bu şablonla bir teklif taslağı hazırlar mısın?" }],
      templateId: constructionTemplateId,
    },
    timeout: 120000,
  });
  console.log("draft-proposal API status:", chatResp.status());
  const rawBody = await chatResp.text();
  // SSE body: one `data: {...}\n\n` frame per DraftEvent (see stream.ts formatEvent).
  const events = rawBody
    .split("\n\n")
    .map((part) => part.trim())
    .filter((line) => line.startsWith("data:"))
    .map((line) => {
      try {
        return JSON.parse(line.slice(5).trim());
      } catch {
        return null;
      }
    })
    .filter(Boolean);
  const fullText = events.filter((e) => e.type === "text").map((e) => e.delta).join("");
  const draftEvent = events.findLast?.((e) => e.type === "draft") ?? [...events].reverse().find((e) => e.type === "draft");
  const errorEvent = events.find((e) => e.type === "error");
  console.log("SSE event types:", events.map((e) => e.type).join(", "));
  console.log("AI text (first 300 chars):", fullText.slice(0, 300));
  if (errorEvent) console.log("SSE error event:", errorEvent.message);
  if (draftEvent) {
    const d = draftEvent.draft;
    console.log("Draft title:", d.title);
    console.log("Draft intro (first 200 chars):", JSON.stringify(d.introText ?? d.sections?.[0]).slice(0, 200));
    console.log("Draft line items:", (d.lineItems ?? []).map((li) => li.name).join(" | "));
  } else {
    console.log("No 'draft' event emitted.");
  }

  // 3) Public/signing page — checklist section variant + view-time tracking wiring.
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
} finally {
  if (bumpedCompanyId) {
    await admin.from("companies").update({ plan: originalPlan }).eq("id", bumpedCompanyId);
    console.log(`Reverted company ${bumpedCompanyId} back to "${originalPlan}".`);
  }
}
