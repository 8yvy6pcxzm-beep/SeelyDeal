// Mobile-viewport smoke test for the SeelyNow widget fab/panel overlap fix
// (public/widget.js): the fab should hide once the panel opens, so it no
// longer covers the compose input/send button on small screens.
//
// Usage: npm run dev (separate terminal), then:
//   node scripts/widget-mobile-check.mjs
import { chromium } from "@playwright/test";
import fs from "fs";

const browser = await chromium.launch({
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: true,
});
const context = await browser.newContext({
  viewport: { width: 390, height: 700 },
  isMobile: true,
  hasTouch: true,
});
const page = await context.newPage();

const consoleErrors = [];
page.on("console", (msg) => msg.type() === "error" && consoleErrors.push(msg.text()));
page.on("pageerror", (err) => consoleErrors.push("pageerror: " + err.message));

fs.mkdirSync("pw-shots", { recursive: true });

await page.goto("http://localhost:3000/", { waitUntil: "load", timeout: 60000 });
await page.waitForFunction(() => !!window.SeelyWidget, { timeout: 20000 });

const host = page.locator("#seely-widget-host");
await host.waitFor({ state: "attached", timeout: 10000 });

async function fabBox() {
  return page.evaluate(() => {
    const root = document.getElementById("seely-widget-host").shadowRoot;
    const fab = root.querySelector(".fab");
    const r = fab.getBoundingClientRect();
    const style = getComputedStyle(fab);
    return { display: style.display, rect: { x: r.x, y: r.y, w: r.width, h: r.height } };
  });
}

async function panelOpen() {
  return page.evaluate(() => {
    const root = document.getElementById("seely-widget-host").shadowRoot;
    return root.querySelector(".panel").classList.contains("open");
  });
}

console.log("Before open — fab:", await fabBox(), "panel open:", await panelOpen());
await page.screenshot({ path: "pw-shots/widget-01-closed.png" });

// Click the fab (shadow DOM — dispatch via evaluate since Playwright locators
// don't pierce closed/open shadow roots the same way across versions).
await page.evaluate(() => {
  document.getElementById("seely-widget-host").shadowRoot.querySelector(".fab").click();
});
await page.waitForTimeout(400);

const afterOpenFab = await fabBox();
const isOpen = await panelOpen();
console.log("After open — fab:", afterOpenFab, "panel open:", isOpen);
await page.screenshot({ path: "pw-shots/widget-02-open.png" });

// Check the send button is not covered by the fab (fab now display:none, so
// it can't intercept clicks / sit visually on top of the compose row).
const sendBtnBox = await page.evaluate(() => {
  const root = document.getElementById("seely-widget-host").shadowRoot;
  const btn = root.querySelector(".ft button");
  const r = btn.getBoundingClientRect();
  return { x: r.x, y: r.y, w: r.width, h: r.height };
});
console.log("Send button box:", sendBtnBox);

const ok = afterOpenFab.display === "none" && isOpen;
console.log("\nRESULT:", ok ? "PASS — fab hides while panel is open" : "FAIL — fab still visible/overlapping");
console.log("Console/page errors:", consoleErrors);

await browser.close();
process.exit(ok ? 0 : 1);
