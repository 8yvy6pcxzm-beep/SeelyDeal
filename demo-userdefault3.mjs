import { chromium } from "playwright";

const BASE = "https://seely-deal.vercel.app";
const shotDir = "/private/tmp/claude-501/-Users-elifakyuz-doa-SeelyDeal/26abdf57-45fb-4608-b589-9e8090182286/scratchpad";
const shot = (n) => `${shotDir}/${n}.png`;

const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({ viewport: { width: 1000, height: 950 } });

await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
await page.fill('input[name="email"]', process.argv[2]);
await page.fill('input[name="password"]', "TestPassword123!");
await page.click('button[type="submit"]');
await page.waitForURL("**/dashboard", { timeout: 20000 }).catch(() => null);
await page.waitForLoadState("networkidle");

// Reuse the template created in the previous run, or create a fresh one.
const createResult = await page.evaluate(async () => {
  const res = await fetch("/api/templates", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Pattern Test 2", sections: [{ title: "Kapsam", body: "Test" }] }),
  });
  return res.json();
});
const templateId = createResult.id;
console.log("template:", templateId);

// Seed the "recently used templates" localStorage list, matching what the app
// itself writes when a template is actually used.
await page.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
await page.evaluate((id) => {
  localStorage.setItem("seelydeal:recent-templates", JSON.stringify([id]));
}, templateId);

async function openDialogAndUseTemplate() {
  await page.click("text=AI ile teklif yaz");
  await page.waitForTimeout(2500);
  const responsePromise = page.waitForResponse(
    (res) => res.url().includes("/api/draft-proposal") && res.request().method() === "POST",
    { timeout: 90000 },
  );
  await page.click(`button:has-text("Pattern Test 2")`);
  const res = await responsePromise;
  const body = await res.json().catch((e) => { console.log("JSON PARSE FAIL", res.status(), e.message); return null; });
  console.log("<<< (template click) FULL:", JSON.stringify(body)?.slice(0, 500));
  await page.waitForTimeout(2000);
  return body;
}

async function sendAndGetReply(text, capMs = 90000) {
  const input = page.locator('textarea, input[type="text"]').last();
  const responsePromise = page.waitForResponse(
    (res) => res.url().includes("/api/draft-proposal") && res.request().method() === "POST",
    { timeout: capMs },
  );
  await input.fill(text);
  await page.keyboard.press("Enter");
  const res = await responsePromise;
  const body = await res.json().catch((e) => { console.log("JSON PARSE FAIL", res.status(), e.message); return null; });
  console.log(`>>> "${text.slice(0, 70)}"`);
  console.log("<<< FULL:", JSON.stringify(body)?.slice(0, 500));
  if (body?.userDefault) console.log(`<<< userDefault: ${JSON.stringify(body.userDefault)}`);
  await page.waitForTimeout(2500);
  return body;
}

await openDialogAndUseTemplate();
await sendAndGetReply("Şirket C için web tasarımı hizmeti, $1000 sabit ücret. PDF olarak hazırla, başka soru sorma.");
await sendAndGetReply("evet, onaylıyorum, kaydet.");
await page.waitForTimeout(3000);

await page.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
await page.evaluate((id) => {
  localStorage.setItem("seelydeal:recent-templates", JSON.stringify([id]));
}, templateId);
await openDialogAndUseTemplate();
await sendAndGetReply("Şirket D için web tasarımı hizmeti, $1200 sabit ücret. PDF olarak hazırla, başka soru sorma.");
let last = await sendAndGetReply("evet, onaylıyorum, kaydet.");

if (!last?.userDefault && (last?.reply || "").toLowerCase().includes("varsayılan")) {
  last = await sendAndGetReply("evet, varsayılanım yap.");
}
if (!last?.userDefault && (last?.reply || "").toLowerCase().includes("hitap")) {
  last = await sendAndGetReply("Elif Varsayılanı olarak etiketle.");
}
console.log("FINAL userDefault block:", JSON.stringify(last?.userDefault));
await page.screenshot({ path: shot("ud3-final-chat") });

await page.goto(`${BASE}/content`, { waitUntil: "networkidle" });
await page.waitForTimeout(1500);
await page.screenshot({ path: shot("ud3-content-library") });

await browser.close();
console.log("done");
