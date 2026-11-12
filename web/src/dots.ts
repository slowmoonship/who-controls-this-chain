// Dot-grid node visualization (emphasis form: one accent hue + neutral gray).
// Dots are ordered by stake weight; identity is carried by fill + legend text,
// never by color alone.

export interface DotSpec {
  id: string; // tooltip identity
  label: string; // tooltip body line
  emphasis: "none" | "pool" | "producer" | "top10";
}

const SVG_NS = "http://www.w3.org/2000/svg";

let tooltip: HTMLDivElement | null = null;

function ensureTooltip(): HTMLDivElement {
  if (!tooltip) {
    tooltip = document.createElement("div");
    tooltip.className = "viz-tooltip";
    tooltip.style.display = "none";
    document.body.appendChild(tooltip);
  }
  return tooltip;
}

function showTooltip(x: number, y: number, title: string, body: string): void {
  const tip = ensureTooltip();
  tip.innerHTML = "";
  const strong = document.createElement("strong");
  strong.textContent = title;
  const span = document.createElement("span");
  span.textContent = body;
  tip.append(strong, span);
  tip.style.display = "block";
  const pad = 12;
  const rect = tip.getBoundingClientRect();
  let left = x + pad;
  let top = y + pad;
  if (left + rect.width > window.innerWidth - 8) left = x - rect.width - pad;
  if (top + rect.height > window.innerHeight - 8) top = y - rect.height - pad;
  tip.style.left = `${left}px`;
  tip.style.top = `${top}px`;
}

function hideTooltip(): void {
  if (tooltip) tooltip.style.display = "none";
}

export function renderDotGrid(container: HTMLElement, dots: DotSpec[], cols: number): void {
  const pitch = 11;
  const r = 3.2;
  const rows = Math.ceil(dots.length / cols);
  const width = cols * pitch;
  const height = rows * pitch;

  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.setAttribute("class", "dot-grid");
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", container.dataset["aria"] || "validator dot grid");

  dots.forEach((d, i) => {
    const cx = (i % cols) * pitch + pitch / 2;
    const cy = Math.floor(i / cols) * pitch + pitch / 2;
    const c = document.createElementNS(SVG_NS, "circle");
    c.setAttribute("cx", String(cx));
    c.setAttribute("cy", String(cy));
    c.setAttribute("r", String(r));
    c.setAttribute("class", `dot dot-${d.emphasis}`);
    if (d.emphasis === "producer") {
      const ring = document.createElementNS(SVG_NS, "circle");
      ring.setAttribute("cx", String(cx));
      ring.setAttribute("cy", String(cy));
      ring.setAttribute("r", String(r + 2.2));
      ring.setAttribute("class", "dot-ring");
      svg.appendChild(ring);
    }
    c.addEventListener("mousemove", (ev) =>
      showTooltip(ev.clientX, ev.clientY, d.id, d.label)
    );
    c.addEventListener("mouseleave", hideTooltip);
    svg.appendChild(c);
  });

  container.replaceChildren(svg);
}
