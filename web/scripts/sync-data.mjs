// Copy the repo-level data/ directory into web/public/data before build/dev,
// so the built site can load JSON with relative fetches on GitHub Pages.
import { cpSync, rmSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const src = join(here, "..", "..", "data");
const dst = join(here, "..", "public", "data");

rmSync(dst, { recursive: true, force: true });
mkdirSync(dst, { recursive: true });
cpSync(src, dst, { recursive: true });
console.log(`synced ${src} -> ${dst}`);
