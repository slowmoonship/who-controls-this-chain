// Metric explanation dialog: what / how / source / limits / verified.

import { t } from "./i18n";

export interface ExplainContent {
  title: string;
  what: string;
  how: string;
  sources: { label: string; url: string }[];
  limits: string;
  verified: string;
}

let dialog: HTMLDialogElement | null = null;

function ensureDialog(): HTMLDialogElement {
  if (dialog) return dialog;
  dialog = document.createElement("dialog");
  dialog.className = "explain-dialog";
  document.body.appendChild(dialog);
  dialog.addEventListener("click", (ev) => {
    if (ev.target === dialog) dialog!.close();
  });
  return dialog;
}

export function openExplain(content: ExplainContent): void {
  const d = ensureDialog();
  d.innerHTML = "";

  const h = document.createElement("h2");
  h.textContent = content.title;

  const dl = document.createElement("dl");
  const row = (label: string, value: string | HTMLElement) => {
    const dt = document.createElement("dt");
    dt.textContent = label;
    const dd = document.createElement("dd");
    if (typeof value === "string") dd.textContent = value;
    else dd.appendChild(value);
    dl.append(dt, dd);
  };

  row(t("whatItIs"), content.what);
  row(t("howComputed"), content.how);

  const ul = document.createElement("ul");
  ul.className = "explain-sources";
  for (const s of content.sources) {
    const li = document.createElement("li");
    const a = document.createElement("a");
    a.href = s.url;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.textContent = s.label;
    li.appendChild(a);
    ul.appendChild(li);
  }
  row(t("sourceLabel"), ul);

  row(t("limitsLabel"), content.limits);
  row(t("updatedLabel"), content.verified);

  const close = document.createElement("button");
  close.className = "explain-close";
  close.textContent = t("close");
  close.addEventListener("click", () => d.close());

  d.append(h, dl, close);
  d.showModal();
}

export function bindExplain(el: HTMLElement, getContent: () => ExplainContent): void {
  el.classList.add("has-explain");
  el.setAttribute("role", "button");
  el.setAttribute("tabindex", "0");
  const go = () => openExplain(getContent());
  el.addEventListener("click", go);
  el.addEventListener("keydown", (ev) => {
    if (ev.key === "Enter" || ev.key === " ") {
      ev.preventDefault();
      go();
    }
  });
}
