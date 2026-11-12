// Acceptance screenshots: desktop, mobile, Chinese toggle, metric dialog.
// Usage: node scripts/shots.mjs [baseURL]   (default http://127.0.0.1:8791/)

import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const base = process.argv[2] ?? "http://127.0.0.1:8791/";
const outDir = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "docs", "screenshots");
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();

// Desktop viewport
const desktop = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await desktop.goto(base, { waitUntil: "networkidle" });
await desktop.screenshot({ path: join(outDir, "desktop-1440x900.png") });
await desktop.screenshot({ path: join(outDir, "desktop-full.png"), fullPage: true });

// Chinese toggle
await desktop.click(".lang-btn");
await desktop.waitForTimeout(200);
await desktop.screenshot({ path: join(outDir, "desktop-zh-1440x900.png") });
await desktop.click(".lang-btn"); // back to EN

// Metric explanation dialog
await desktop.click(".cmp-table tbody tr");
await desktop.waitForTimeout(200);
await desktop.screenshot({ path: join(outDir, "desktop-dialog.png") });
await desktop.keyboard.press("Escape");

// Mobile viewport
const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
await mobile.goto(base, { waitUntil: "networkidle" });
await mobile.screenshot({ path: join(outDir, "mobile-390x844.png") });
await mobile.screenshot({ path: join(outDir, "mobile-full.png"), fullPage: true });

// Horizontal overflow check on mobile
const overflow = await mobile.evaluate(
  () => document.documentElement.scrollWidth - document.documentElement.clientWidth
);
console.log(`mobile horizontal overflow px: ${overflow}`);

await browser.close();
console.log(`screenshots written to ${outDir}`);
