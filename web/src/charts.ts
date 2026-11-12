// Minimal sparkline (single series, 2px line, hover markers). No chart library.

const SVG_NS = "http://www.w3.org/2000/svg";

export interface SparkPoint {
  t: string; // ISO time
  v: number;
}

export function renderSparkline(
  container: HTMLElement,
  points: SparkPoint[],
  valueFmt: (v: number) => string
): boolean {
  if (points.length < 2) {
    container.replaceChildren();
    return false;
  }
  const width = 160;
  const height = 44;
  const pad = 4;
  const vals = points.map((p) => p.v);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const span = max - min || 1;

  const x = (i: number) => pad + (i * (width - 2 * pad)) / (points.length - 1);
  const y = (v: number) => height - pad - ((v - min) / span) * (height - 2 * pad);

  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.setAttribute("class", "sparkline");
  svg.setAttribute("role", "img");
  svg.setAttribute(
    "aria-label",
    `trend: ${points.map((p) => valueFmt(p.v)).join(", ")}`
  );

  const path = document.createElementNS(SVG_NS, "path");
  path.setAttribute(
    "d",
    points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p.v).toFixed(1)}`).join(" ")
  );
  path.setAttribute("class", "spark-path");
  svg.appendChild(path);

  // Hover layer: one hit rect per segment, marker + label on hover.
  const marker = document.createElementNS(SVG_NS, "circle");
  marker.setAttribute("r", "4");
  marker.setAttribute("class", "spark-marker");
  marker.style.display = "none";
  svg.appendChild(marker);

  const label = document.createElementNS(SVG_NS, "text");
  label.setAttribute("class", "spark-label");
  label.style.display = "none";
  svg.appendChild(label);

  points.forEach((p, i) => {
    const hit = document.createElementNS(SVG_NS, "rect");
    const segW = (width - 2 * pad) / (points.length - 1);
    hit.setAttribute("x", String(x(i) - segW / 2));
    hit.setAttribute("y", "0");
    hit.setAttribute("width", String(segW));
    hit.setAttribute("height", String(height));
    hit.setAttribute("class", "spark-hit");
    hit.addEventListener("mouseenter", () => {
      marker.setAttribute("cx", String(x(i)));
      marker.setAttribute("cy", String(y(p.v)));
      marker.style.display = "block";
      label.textContent = `${valueFmt(p.v)} · ${p.t.slice(0, 10)}`;
      label.setAttribute("x", String(Math.min(x(i) + 6, width - 4)));
      label.setAttribute("y", String(Math.max(y(p.v) - 8, 10)));
      label.style.display = "block";
    });
    hit.addEventListener("mouseleave", () => {
      marker.style.display = "none";
      label.style.display = "none";
    });
    svg.appendChild(hit);
  });

  container.replaceChildren(svg);
  return true;
}
