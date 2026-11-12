import "./style.css";
import { renderApp } from "./render";
import { getLang, setLang, type Lang } from "./i18n";
import type { HistoryEntry, LastAttempt, SiteData, Snapshot } from "./types";

const DATA_BASE = "./data";

async function getJson<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${DATA_BASE}/${path}`, { cache: "no-cache" });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

function renderError(root: HTMLElement, message: string): void {
  root.innerHTML = "";
  const p = document.createElement("p");
  p.className = "load-error";
  p.textContent = message;
  root.appendChild(p);
}

async function boot(): Promise<void> {
  const root = document.getElementById("app");
  if (!root) return;

  const latest = await getJson<Snapshot>("latest.json");
  if (!latest) {
    renderError(root, "Data unavailable: could not load data/latest.json. The collector may not have run yet.");
    return;
  }

  const [history, sources, methodology, lastAttempt] = await Promise.all([
    getJson<HistoryEntry[]>("history/index.json"),
    getJson<Record<string, unknown>>("sources.json"),
    getJson<Record<string, unknown>>("methodology.json"),
    getJson<LastAttempt>("last_attempt.json"),
  ]);

  const data: SiteData = {
    latest,
    history: history ?? [],
    sources: sources ?? {},
    methodology: methodology ?? {},
    lastAttempt,
  };

  const draw = (): void => {
    renderApp(root, data, (next: Lang) => {
      setLang(next);
      localStorage.setItem("wctc-lang", next);
      draw();
    }, getLang());
  };

  const saved = localStorage.getItem("wctc-lang");
  if (saved === "zh" || saved === "en") setLang(saved);
  draw();
}

void boot();
