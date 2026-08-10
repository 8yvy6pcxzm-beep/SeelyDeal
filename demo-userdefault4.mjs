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

await page.click("text=AI ile teklif yaz");
await page.waitForTimeout(2500);

const input = page.locator('textarea, input[type="text"]').last();
async function sendAndGetReply(text, capMs = 90000) {
  const responsePromise = page.waitForResponse(
    (res) => res.url().includes("/api/draft-proposal") && res.request().method() === "POST",
    { timeout: capMs },
  );
  await input.fill(text);
  await page.keyboard.press("Enter");
  const res = await responsePromise;
  const body = await res.json().catch(() => null);
  console.log(`>>> "${text.slice(0, 70)}"`);
  console.log("<<< FULL:", JSON.stringify(body)?.slice(0, 500));
  await page.waitForTimeout(2000);
  return body;
}

// Reuse the same template id used in the earlier run so this counts as the
// "3rd consecutive same template+format" turn.
await sendAndGetReply(
  `Şirket E için web tasarımı hizmeti, $1200 sabit ücret, PDF olarak hazırla, başka soru sorma. Az önceki gibi aynı şablonu kullan.`,
);
let last = await sendAndGetReply("evet, onaylıyorum, kaydet.");

if (!last?.userDefault && (last?.reply || "").toLowerCase().includes("varsayılan")) {
  last = await sendAndGetReply("evet, varsayılanım yap.");
}
if (!last?.userDefault && (last?.reply || "").toLowerCase().includes("hitap")) {
  last = await sendAndGetReply("Elif Varsayılanı olarak etiketle.");
}
console.log("FINAL userDefault block:", JSON.stringify(last?.userDefault));
await page.screenshot({ path: shot("ud4-final-chat") });

await page.goto(`${BASE}/content`, { waitUntil: "networkidle" });
await page.waitForTimeout(1500);
await page.screenshot({ path: shot("ud4-content-library") });

await browser.close();
console.log("done");
