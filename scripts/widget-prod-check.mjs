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
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));

await page.goto("https://seely-deal.vercel.app/", { waitUntil: "load", timeout: 60000 });
await page.waitForFunction(() => !!window.SeelyWidget, { timeout: 20000 });

async function fabDisplay() {
  return page.evaluate(() => {
    const root = document.getElementById("seely-widget-host").shadowRoot;
    return getComputedStyle(root.querySelector(".fab")).display;
  });
}
async function panelOpen() {
  return page.evaluate(() => document.getElementById("seely-widget-host").shadowRoot.querySelector(".panel").classList.contains("open"));
}

console.log("PROD closed — fab display:", await fabDisplay(), "panel open:", await panelOpen());
await page.screenshot({ path: "pw-shots/prod-widget-closed.png" });

await page.evaluate(() => document.getElementById("seely-widget-host").shadowRoot.querySelector(".fab").click());
await page.waitForTimeout(500);

console.log("PROD open — fab display:", await fabDisplay(), "panel open:", await panelOpen());
await page.screenshot({ path: "pw-shots/prod-widget-open.png" });

console.log("Page errors:", errors);
await browser.close();
