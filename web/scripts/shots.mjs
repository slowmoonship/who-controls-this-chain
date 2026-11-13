// Acceptance screenshots and layout checks.
// Usage: node scripts/shots.mjs [baseURL]   (default http://127.0.0.1:8807/)

import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const base = process.argv[2] ?? "http://127.0.0.1:8807/";
const outDir = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "docs", "screenshots");
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
const failures = [];

function measure() {
  const de = document.documentElement;
  const bodyStyle = getComputedStyle(document.body);
  const htmlStyle = getComputedStyle(de);
  const app = document.querySelector("#app");
  const appStyle = app ? getComputedStyle(app) : null;
  const summary = document.querySelector("details.evidence > summary");
  const title = document.querySelector(".site-title");
  const controls = document.querySelector(".header-controls");
  const titleBox = title?.getBoundingClientRect();
  const controlsBox = controls?.getBoundingClientRect();
  const overlap =
    titleBox && controlsBox
      ? !(
          titleBox.right <= controlsBox.left ||
          controlsBox.right <= titleBox.left ||
          titleBox.bottom <= controlsBox.top ||
          controlsBox.bottom <= titleBox.top
        )
      : null;
  return {
    scrollHeight: de.scrollHeight,
    clientHeight: de.clientHeight,
    scrollWidth: de.scrollWidth,
    clientWidth: de.clientWidth,
    verticalScroll: de.scrollHeight - de.clientHeight,
    horizontalOverflow: de.scrollWidth - de.clientWidth,
    htmlOverflow: htmlStyle.overflow,
    bodyOverflow: bodyStyle.overflow,
    appOverflow: appStyle ? appStyle.overflow : null,
    appHeight: appStyle ? appStyle.height : null,
    detailsOpen: document.querySelector("details.evidence")?.open ?? null,
    summary: summary?.textContent ?? null,
    summaryAfter: summary ? getComputedStyle(summary, "::after").content : null,
    conclusion: document.querySelector(".conclusion")?.textContent ?? null,
    scope: document.querySelector(".conclusion-scope")?.textContent ?? null,
    subtitle: document.querySelector(".site-subtitle")?.textContent ?? null,
    github: document.querySelector('a[aria-label="GitHub"]')?.href ?? null,
    x: document.querySelector('a[aria-label="X"]')?.href ?? null,
    rows: [...document.querySelectorAll(".home-table tbody tr")].map((tr) =>
      [...tr.children].map((c) => c.textContent.replace(/\s+/g, " ").trim())
    ),
    bars: [...document.querySelectorAll(".bar-row")].map((row) => ({
      name: row.querySelector(".bar-name")?.textContent ?? "",
      value: row.querySelector(".bar-value")?.textContent ?? "",
      width: row.querySelector(".bar-fill")?.style.width ?? "",
    })),
    scripts: [...document.scripts].map((s) => s.src),
    overlap,
  };
}

const desktop = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await desktop.goto(base, { waitUntil: "networkidle" });
await desktop.waitForSelector(".conclusion");
const desktopCollapsed = await desktop.evaluate(measure);
await desktop.screenshot({ path: join(outDir, "desktop-1440x900.png") });
await desktop.screenshot({ path: join(outDir, "desktop-full.png"), fullPage: true });

if (desktopCollapsed.detailsOpen !== false) failures.push("desktop details not collapsed");
if (desktopCollapsed.verticalScroll > 0) failures.push(`desktop vertical scroll ${desktopCollapsed.verticalScroll}px`);
if (desktopCollapsed.horizontalOverflow > 0) failures.push(`desktop horizontal overflow ${desktopCollapsed.horizontalOverflow}px`);
for (const target of [desktopCollapsed.htmlOverflow, desktopCollapsed.bodyOverflow, desktopCollapsed.appOverflow]) {
  if (target === "hidden") failures.push("overflow:hidden used on page root");
}
if (desktopCollapsed.github !== "https://github.com/slowmoonship") failures.push(`github href ${desktopCollapsed.github}`);
if (desktopCollapsed.x !== "https://x.com/slowmoonship") failures.push(`x href ${desktopCollapsed.x}`);
if (desktopCollapsed.overlap) failures.push("desktop title overlaps controls");

await desktop.click("details.evidence > summary");
await desktop.waitForTimeout(150);
const opened = await desktop.evaluate(() => document.querySelector("details.evidence")?.open ?? null);
if (opened !== true) failures.push("details did not open");
const layerCount = await desktop.locator("details.evidence-layer").count();
if (layerCount < 5) failures.push(`expected layered evidence, got ${layerCount}`);
await desktop.click("details.evidence-layer > summary");
await desktop.waitForTimeout(150);
const layerOpen = await desktop.evaluate(() => document.querySelector("details.evidence-layer")?.open ?? null);
if (layerOpen !== true) failures.push("nested evidence did not open");
await desktop.click("details.evidence > summary");
await desktop.waitForTimeout(150);
const closedAgain = await desktop.evaluate(() => document.querySelector("details.evidence")?.open ?? null);
if (closedAgain !== false) failures.push("details did not close");

await desktop.click(".lang-btn");
await desktop.waitForTimeout(200);
const zh = await desktop.evaluate(measure);
await desktop.screenshot({ path: join(outDir, "desktop-zh-1440x900.png") });
if (!String(zh.conclusion).includes("权力集中信号更强") && !String(zh.conclusion).includes("接近") && !String(zh.conclusion).includes("相同")) {
  failures.push(`unexpected zh conclusion: ${zh.conclusion}`);
}
if (zh.summary !== "详细证据与研究方法") failures.push(`zh summary ${zh.summary}`);
if (zh.verticalScroll > 0) failures.push(`zh desktop vertical scroll ${zh.verticalScroll}px`);
await desktop.click(".lang-btn");

await desktop.click(".home-table tbody tr");
await desktop.waitForTimeout(200);
const dialog = await desktop.locator("dialog, .explain-dialog, [role='dialog']").count();
if (dialog < 1) failures.push("metric dialog did not open");
await desktop.screenshot({ path: join(outDir, "desktop-dialog.png") });
await desktop.keyboard.press("Escape");

const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
await mobile.goto(base, { waitUntil: "networkidle" });
await mobile.waitForSelector(".conclusion");
const mobileCollapsed = await mobile.evaluate(measure);
await mobile.screenshot({ path: join(outDir, "mobile-390x844.png") });
await mobile.screenshot({ path: join(outDir, "mobile-full.png"), fullPage: true });
if (mobileCollapsed.horizontalOverflow > 0) failures.push(`mobile horizontal overflow ${mobileCollapsed.horizontalOverflow}px`);
if (mobileCollapsed.detailsOpen !== false) failures.push("mobile details not collapsed");
if (mobileCollapsed.overlap) failures.push("mobile title overlaps controls");
if (mobileCollapsed.bars.length < 2) failures.push("mobile bars missing");

await mobile.click("details.evidence > summary");
await mobile.waitForTimeout(150);
const mobileOpen = await mobile.evaluate(() => document.querySelector("details.evidence")?.open ?? null);
if (mobileOpen !== true) failures.push("mobile details did not open");
const mobileOpenOverflow = await mobile.evaluate(
  () => document.documentElement.scrollWidth - document.documentElement.clientWidth
);
if (mobileOpenOverflow > 0) failures.push(`mobile open horizontal overflow ${mobileOpenOverflow}px`);
await mobile.click(".lang-btn");
await mobile.waitForTimeout(150);
const mobileZh = await mobile.evaluate(() => document.querySelector(".conclusion")?.textContent ?? "");
if (!mobileZh.includes("权力集中信号更强") && !mobileZh.includes("接近") && !mobileZh.includes("相同")) {
  failures.push(`unexpected mobile zh conclusion: ${mobileZh}`);
}

const report = {
  capturedAt: new Date().toISOString(),
  base,
  desktopCollapsed,
  zhConclusion: zh.conclusion,
  zhScope: zh.scope,
  mobileCollapsed,
  failures,
};
writeFileSync(join(outDir, "capture.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify({ failures, desktop: {
  scrollHeight: desktopCollapsed.scrollHeight,
  clientHeight: desktopCollapsed.clientHeight,
  verticalScroll: desktopCollapsed.verticalScroll,
  conclusion: desktopCollapsed.conclusion,
  scope: desktopCollapsed.scope,
  summary: desktopCollapsed.summary,
  bars: desktopCollapsed.bars,
  rows: desktopCollapsed.rows.length,
  scripts: desktopCollapsed.scripts,
}, mobile: {
  scrollHeight: mobileCollapsed.scrollHeight,
  clientHeight: mobileCollapsed.clientHeight,
  horizontalOverflow: mobileCollapsed.horizontalOverflow,
  overlap: mobileCollapsed.overlap,
  bars: mobileCollapsed.bars,
}}, null, 2));

await browser.close();
if (failures.length) {
  console.error("ACCEPTANCE FAILED");
  process.exit(1);
}
console.log(`screenshots written to ${outDir}`);
