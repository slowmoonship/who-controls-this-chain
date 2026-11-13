// Page assembly. Plain DOM, no framework.

import { renderDotGrid, type DotSpec } from "./dots";
import { renderSparkline } from "./charts";
import { bindExplain, type ExplainContent } from "./explain";
import { t, type Lang } from "./i18n";
import { ageText, num, pct, shortAddr, utcTime } from "./format";
import type { SiteData, Snapshot, ValidatorRow } from "./types";

const GITHUB_URL = "https://github.com/slowmoonship";
const X_URL = "https://x.com/slowmoonship";

interface ChainView {
  id: string;
  name: string;
  shortName: string;
  validators: number;
  top10: number;
  n33: number;
  selection: string;
  upgrade: string;
}

interface SourceEntry {
  id: string;
  label: string;
  url: string;
  kind: string;
}

function collectSources(data: SiteData): Map<string, SourceEntry> {
  const map = new Map<string, SourceEntry>();
  const root = data.sources as Record<string, SourceEntry[]>;
  for (const group of Object.values(root)) {
    if (Array.isArray(group)) {
      for (const s of group) map.set(s.id, s);
    }
  }
  return map;
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function fmtAge(iso: string): string {
  return ageText(iso);
}

/* ---------------- explain content builders ---------------- */

function explainFrom(
  titleKey: string,
  whatKey: string,
  howKey: string,
  limitsKey: string,
  sources: SourceEntry[],
  verified: string
): ExplainContent {
  return {
    title: t(titleKey),
    what: t(whatKey),
    how: t(howKey),
    sources: sources.map((s) => ({ label: s.label, url: s.url })),
    limits: t(limitsKey),
    verified,
  };
}

/* ---------------- hero panels ---------------- */

function avatarDotsAvalanche(snap: Snapshot): DotSpec[] {
  const av = snap.networks.avalanche!;
  const total = Number(av.metrics.total_weight);
  return av.weights_sorted_desc.map((w, i) => {
    const share = Number(w) / total;
    const idRow = av.top10[i];
    return {
      id: idRow?.node_id ?? `#${i + 1}`,
      label: `${pct(share, 2)} ${t("ofValidators") === "" ? "" : "of total weight"}`,
      emphasis: i < 10 ? "top10" : "none",
    };
  });
}

function avatarDotsPolygon(snap: Snapshot): DotSpec[] {
  const px = snap.networks.polygon_pos!;
  const rows: ValidatorRow[] = px.validators_all ?? px.top10;
  const pool = new Set(px.bor.vote_tally_top.map((v) => v.val_id));
  const producers = new Set(px.bor.current_span.producers.map((p) => p.val_id));
  return rows.map((r) => {
    const isProducer = producers.has(r.val_id ?? "");
    const isPool = pool.has(r.val_id ?? "");
    return {
      id: r.name ? `${r.val_id} · ${r.name}` : `Validator ${r.val_id}`,
      label: `${pct(r.share, 2)} of voting power · ${shortAddr(r.signer)}`,
      emphasis: isProducer ? "producer" : isPool ? "pool" : "none",
    };
  });
}

function statTile(
  label: string,
  value: string,
  sub?: string,
  explain?: () => ExplainContent
): HTMLElement {
  const tile = el("div", "stat-tile");
  const valueCls = value.length > 12 ? "stat-value small" : "stat-value";
  tile.append(el("div", "stat-label", label), el("div", valueCls, value));
  if (sub) tile.append(el("div", "stat-sub", sub));
  if (explain) bindExplain(tile, explain);
  return tile;
}

function plural(n: number, one: string, many: string): string {
  return n === 1 ? one : many;
}

function legendItem(cls: string, label: string): HTMLElement {
  const li = el("span", "legend-item");
  const dot = el("span", `legend-dot ${cls}`);
  li.append(dot, document.createTextNode(label));
  return li;
}

function renderSpanRotation(panel: HTMLElement, data: SiteData): void {
  const px = data.latest.networks.polygon_pos;
  if (!px) return;
  const bor = px.bor;
  const spans = [...bor.recent_spans].reverse();
  if (!spans.length) return;

  const names = new Map<string, string>();
  for (const row of px.validators_all ?? px.top10) {
    if (row.val_id && row.name) names.set(row.val_id, row.name);
  }

  const wrap = el("div", "rotation");
  wrap.append(el("div", "stat-label", t("rotationTitle")));
  const row = el("div", "rotation-row");
  const currentId = bor.current_span.id;
  for (const span of spans) {
    const ids = span.producers.map((p) => p.val_id).filter(Boolean);
    const chip = el("span", span.id === currentId ? "rot-chip current" : "rot-chip");
    if (span.id === currentId) chip.setAttribute("aria-current", "true");
    chip.append(el("span", "rot-span", `#${span.id}`), el("span", "rot-who", ids.join("+") || "—"));
    const who = ids
      .map((id) => (names.get(id) ? `${id} ${names.get(id)}` : id))
      .join(", ");
    chip.title = `span #${span.id} · ${who} · blocks ${num(span.start_block)}–${num(span.end_block)}`;
    row.append(chip);
  }
  wrap.append(row);

  const distinct = new Set(spans.flatMap((s) => s.producers.map((p) => p.val_id).filter(Boolean)));
  wrap.append(
    el(
      "p",
      "fine-print",
      t("rotationSummary", { spans: spans.length, distinct: distinct.size })
    )
  );
  bindExplain(wrap, () =>
    explainFrom(
      "rowBlockProd",
      "mBlockWhat",
      "mBlockHow",
      "mBlockLimits",
      [srcById(data, "heimdall-spans-by-id"), srcById(data, "heimdall-v2-veblop")].filter(Boolean) as SourceEntry[],
      data.latest.generated_at
    )
  );
  panel.append(wrap);
}

function renderPolygonPanel(panel: HTMLElement, data: SiteData): void {
  const snap = data.latest;
  const px = snap.networks.polygon_pos!;
  const h = px.heimdall;
  const bor = px.bor;
  const verified = snap.generated_at;

  panel.append(el("div", "chain-name", "POLYGON PoS"));
  panel.append(el("div", "chain-sub", "Heimdall v2 + Bor"));

  const hero = el("div", "hero-line");
  const nProd = bor.current_span.producers.length;
  hero.append(
    el("span", "hero-big", num(h.active_validators)),
    el(
      "span",
      "hero-op",
      plural(h.active_validators, t("heroVal1"), t("heroVal")) + " ≠"
    ),
    el("span", "hero-big accent", num(nProd)),
    el("span", "hero-op", plural(nProd, t("heroProd1"), t("heroProd")))
  );
  panel.append(hero);
  panel.append(el("p", "hero-mech", t("producerMech")));

  const tiles = el("div", "stat-row");
  const prodNames = bor.current_span.producers
    .map((p) => (p.name ? `#${p.val_id} ${p.name}` : `#${p.val_id}`))
    .join(", ");
  tiles.append(
    statTile(
      t("producersNow"),
      String(bor.current_span.producers.length),
      prodNames,
      () =>
        explainFrom(
          "rowBlockProd",
          "mBlockWhat",
          "mBlockHow",
          "mBlockLimits",
          [srcById(data, "heimdall-span-latest"), srcById(data, "heimdall-v2-veblop")].filter(Boolean) as SourceEntry[],
          verified
        )
    ),
    statTile(
      t("electedPool"),
      String(bor.vote_tally_top.length || bor.producer_set_limit),
      t("poolSub", {
        n: bor.vote_tally_top.length || bor.producer_set_limit,
        total: h.active_validators,
      }),
      () =>
        explainFrom(
          "rowBlockProd",
          "mBlockWhat",
          "mBlockHow",
          "mBlockLimits",
          [srcById(data, "heimdall-producer-votes"), srcById(data, "heimdall-v2-veblop")].filter(Boolean) as SourceEntry[],
          verified
        )
    ),
    statTile(
      t("rowValidators"),
      num(h.active_validators),
      t("validatorsNote"),
      () =>
        explainFrom(
          "rowValidators",
          "mValidatorsWhat",
          "mValidatorsHow",
          "mValidatorsLimits",
          [srcById(data, "heimdall-validators-set")].filter(Boolean) as SourceEntry[],
          verified
        )
    ),
    statTile(
      t("rowTop10"),
      pct(h.top10_share),
      `max ${pct(h.max_share)}`,
      () =>
        explainFrom(
          "rowTop10",
          "mTop10What",
          "mTop10How",
          "mTop10Limits",
          [srcById(data, "heimdall-validators-set")].filter(Boolean) as SourceEntry[],
          verified
        )
    )
  );
  panel.append(tiles);

  const spanLine = el("div", "span-line");
  spanLine.append(
    el("span", "span-chip", `${t("spanId")} #${bor.current_span.id}`),
    el(
      "span",
      "span-range",
      `${t("blockRange")}: ${num(bor.current_span.start_block)}–${num(bor.current_span.end_block)} · ${num(
        bor.params.span_duration
      )} ${t("spanLength")}`
    )
  );
  panel.append(spanLine);
  panel.append(
    el(
      "div",
      "fine-print",
      t("producerRatio", {
        n: nProd,
        total: h.active_validators,
        share: pct(nProd / h.active_validators),
        span: bor.current_span.id,
      })
    )
  );

  renderSpanRotation(panel, data);

  const gridWrap = el("div", "grid-wrap");
  gridWrap.dataset["aria"] = "Polygon PoS validators, one dot each";
  renderDotGrid(gridWrap, avatarDotsPolygon(snap), 20);
  panel.append(gridWrap);

  const legend = el("div", "legend");
  legend.append(
    legendItem("dot-producer", t("currentProducer")),
    legendItem("dot-pool", t("poolMember")),
    legendItem("dot-none", t("otherValidators"))
  );
  panel.append(legend);
  panel.append(el("div", "fine-print", t("dotsOrdered") + " · " + t("votesNote")));
  panel.append(el("div", "fine-print caveat", t("producerCaveat")));
}

function renderAvalanchePanel(panel: HTMLElement, data: SiteData): void {
  const snap = data.latest;
  const av = snap.networks.avalanche!;
  const m = av.metrics;
  const verified = snap.generated_at;

  panel.append(el("div", "chain-name", "AVALANCHE"));
  panel.append(el("div", "chain-sub", "Primary Network"));

  const hero = el("div", "hero-line");
  hero.append(
    el("span", "hero-big", num(m.active_validators)),
    el("span", "hero-op", plural(m.active_validators, t("heroVal1"), t("heroVal")) + " ·"),
    el("span", "hero-big", "0"),
    el("span", "hero-op", t("heroFixed"))
  );
  panel.append(hero);
  panel.append(el("p", "hero-mech", t("avaxHeroLine") + " — " + t("avaxProdNote")));

  const delegatedShare = Number(m.delegated_weight) / Number(m.total_weight);
  const tiles = el("div", "stat-row");
  tiles.append(
    statTile(
      t("rowValidators"),
      num(m.active_validators),
      t("validatorsNote"),
      () =>
        explainFrom(
          "rowValidators",
          "mValidatorsWhat",
          "mValidatorsHow",
          "mValidatorsLimits",
          [srcById(data, "avax-pchain-validators")].filter(Boolean) as SourceEntry[],
          verified
        )
    ),
    statTile(
      t("rowTop10"),
      pct(m.top10_share),
      `max ${pct(m.max_share)}`,
      () =>
        explainFrom(
          "rowTop10",
          "mTop10What",
          "mTop10How",
          "mTop10Limits",
          [srcById(data, "avax-pchain-validators")].filter(Boolean) as SourceEntry[],
          verified
        )
    ),
    statTile(
      t("ncTileLabel"),
      `${m.nakamoto.n_33} / ${m.nakamoto.n_50}`,
      t("rowNakamotoUnit"),
      () =>
        explainFrom(
          "rowNakamoto",
          "mNakamotoWhat",
          "mNakamotoHow",
          "mNakamotoLimits",
          [srcById(data, "avax-pchain-validators"), srcById(data, "snow-whitepaper")].filter(Boolean) as SourceEntry[],
          verified
        )
    ),
    statTile(
      t("rowBlockProd"),
      t("diffModel"),
      t("blockProdAvalanche"),
      () =>
        explainFrom(
          "rowBlockProd",
          "mBlockWhat",
          "mBlockHow",
          "mBlockLimits",
          [srcById(data, "avalanchego-upgrade")].filter(Boolean) as SourceEntry[],
          verified
        )
    )
  );
  panel.append(tiles);

  const gridWrap = el("div", "grid-wrap");
  gridWrap.dataset["aria"] = "Avalanche Primary Network validators, one dot each";
  renderDotGrid(gridWrap, avatarDotsAvalanche(snap), 34);
  panel.append(gridWrap);

  const legend = el("div", "legend");
  legend.append(
    legendItem("dot-top10", t("top10ByWeight")),
    legendItem("dot-none", t("otherValidators"))
  );
  panel.append(legend);
  panel.append(
    el("div", "fine-print", `${t("dotsOrdered")} · ${pct(delegatedShare)} ${t("delegated")}`)
  );
}

function srcById(data: SiteData, id: string): SourceEntry | null {
  return collectSources(data).get(id) ?? null;
}

/* ---------------- comparison table ---------------- */

function renderTable(section: HTMLElement, data: SiteData): void {
  const snap = data.latest;
  const av = snap.networks.avalanche;
  const px = snap.networks.polygon_pos;
  if (!av || !px) return;
  const verified = snap.generated_at;

  section.append(el("h2", "section-title", t("comparisonTitle")));

  const table = el("table", "cmp-table");
  const thead = el("thead");
  const headRow = el("tr");
  headRow.append(
    el("th", "", t("metric")),
    el("th", "", "AVALANCHE"),
    el("th", "", "POLYGON PoS")
  );
  thead.append(headRow);
  table.append(thead);

  const tbody = el("tbody");
  const row = (
    label: string,
    a: string,
    p: string,
    sub: string | null,
    explain: () => ExplainContent,
    accent = true
  ) => {
    const tr = el("tr");
    const th = el("th", "row-label", label);
    const tdA = el("td");
    tdA.append(el("span", "cell-main", a));
    const tdP = el("td");
    tdP.append(el("span", accent ? "cell-main accent-text" : "cell-main", p));
    if (sub) {
      const s = el("div", "cell-sub", sub);
      tdP.append(s);
    }
    tr.append(th, tdA, tdP);
    bindExplain(tr, explain);
    tbody.append(tr);
  };

  const ncExplain = () =>
    explainFrom(
      "rowNakamoto",
      "mNakamotoWhat",
      "mNakamotoHow",
      "mNakamotoLimits",
      [srcById(data, "cometbft-thresholds"), srcById(data, "snow-whitepaper")].filter(Boolean) as SourceEntry[],
      verified
    );

  row(
    t("rowValidators"),
    num(av.metrics.active_validators),
    num(px.heimdall.active_validators),
    null,
    () =>
      explainFrom(
        "rowValidators",
        "mValidatorsWhat",
        "mValidatorsHow",
        "mValidatorsLimits",
        [srcById(data, "avax-pchain-validators"), srcById(data, "heimdall-validators-set")].filter(Boolean) as SourceEntry[],
        verified
      )
  );
  row(
    t("rowTop10"),
    pct(av.metrics.top10_share),
    pct(px.heimdall.top10_share),
    null,
    () =>
      explainFrom(
        "rowTop10",
        "mTop10What",
        "mTop10How",
        "mTop10Limits",
        [srcById(data, "avax-pchain-validators"), srcById(data, "heimdall-validators-set")].filter(Boolean) as SourceEntry[],
        verified
      )
  );
  row(
    t("rowMax"),
    pct(av.metrics.max_share),
    pct(px.heimdall.max_share),
    null,
    () =>
      explainFrom(
        "rowMax",
        "mMaxWhat",
        "mMaxHow",
        "mMaxLimits",
        [srcById(data, "avax-pchain-validators"), srcById(data, "heimdall-validators-set")].filter(Boolean) as SourceEntry[],
        verified
      )
  );
  row(
    t("rowNakamoto"),
    `${av.metrics.nakamoto.n_33} / ${av.metrics.nakamoto.n_50}`,
    `${px.heimdall.nakamoto.n_33} / ${px.heimdall.nakamoto.n_50}`,
    t("rowNakamotoUnit"),
    ncExplain
  );
  row(
    t("rowEntity"),
    t("entityUnknown"),
    t("entityUnknown"),
    null,
    () => ({
      title: t("rowEntity"),
      what: t("mEntityWhat"),
      how: t("mEntityHow"),
      sources: [{ label: "methodology.json", url: "./data/methodology.json" }],
      limits: t("mEntityLimits"),
      verified,
    }),
    false
  );
  row(
    t("rowBlockProd"),
    t("blockProdAvalanche"),
    t("blockProdPolygon", { pool: String(px.bor.vote_tally_top.length || px.bor.producer_set_limit) }),
    null,
    () =>
      explainFrom(
        "rowBlockProd",
        "mBlockWhat",
        "mBlockHow",
        "mBlockLimits",
        [srcById(data, "heimdall-v2-veblop")].filter(Boolean) as SourceEntry[],
        verified
      )
  );
  row(
    t("rowUpgrade"),
    t("upgradeAvalanche"),
    t("upgradePolygon"),
    null,
    () =>
      explainFrom(
        "rowUpgrade",
        "mUpgradeWhat",
        "mUpgradeHow",
        "mUpgradeLimits",
        [srcById(data, "timelock"), srcById(data, "safe-multisig"), srcById(data, "avalanchego-upgrade")].filter(Boolean) as SourceEntry[],
        verified
      )
  );

  table.append(tbody);
  section.append(table);
  section.append(el("p", "fine-print", t("ncCaveat")));
}

/* ---------------- rules section ---------------- */

function renderRules(section: HTMLElement, data: SiteData): void {
  const snap = data.latest;
  const av = snap.networks.avalanche;
  const px = snap.networks.polygon_pos;
  const safe = snap.networks.authority?.polygon_l1.safe;
  const timelock = snap.networks.authority?.polygon_l1.timelock;
  const poolSize = px ? px.bor.vote_tally_top.length || px.bor.producer_set_limit : 0;
  const nProd = px ? px.bor.current_span.producers.length : 0;
  const avN = av ? num(av.metrics.active_validators) : "—";
  const pxN = px ? num(px.heimdall.active_validators) : "—";
  const avTop = av ? pct(av.metrics.top10_share) : "—";
  const pxTop = px ? pct(px.heimdall.top10_share) : "—";
  const n33 = px ? num(px.heimdall.nakamoto.n_33) : "—";
  const n50 = px ? num(px.heimdall.nakamoto.n_50) : "—";
  const threshold = safe?.threshold ?? "—";
  const owners = safe?.owners_count ?? "—";
  const delay = timelock?.min_delay_seconds ?? "—";

  section.append(el("h2", "section-title", t("rulesTitle")));
  section.append(el("p", "section-sub", t("rulesSub")));

  const grid = el("div", "rules-grid");

  const cell = (title: string, fact: string, risk: string, evs: SourceEntry[]) => {
    const c = el("div", "rule-cell");
    c.append(el("div", "rule-kind", title));
    c.append(el("p", "rule-fact", fact));
    const riskWrap = el("p", "rule-risk");
    riskWrap.append(el("span", "risk-tag", `⚠ ${t("riskLabel")}`), document.createTextNode(" " + risk));
    c.append(riskWrap);
    const evWrap = el("p", "rule-ev");
    evWrap.append(el("span", "ev-tag", `${t("evidenceLabel")}: `));
    evs.filter(Boolean).forEach((s, i) => {
      if (i > 0) evWrap.append(document.createTextNode(" · "));
      const a = el("a", "ev-link", s.label.split("—")[0].trim());
      a.href = s.url;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      evWrap.append(a);
    });
    c.append(evWrap);
    return c;
  };

  const row = el("div", "rule-row");
  row.append(el("div", "rule-row-title", t("rcTitle")));
  row.append(
    cell(
      "AVALANCHE",
      t("rcAvalanche", { n: avN }),
      t("rcAvalancheRisk", { top10: avTop }),
      [srcById(data, "avax-pchain-validators")].filter(Boolean) as SourceEntry[]
    )
  );
  row.append(
    cell(
      "POLYGON PoS",
      t("rcPolygon", { n: pxN, top10: pxTop }),
      t("rcPolygonRisk", { n33, n50 }),
      [srcById(data, "heimdall-validators-set"), srcById(data, "cometbft-thresholds")].filter(Boolean) as SourceEntry[]
    )
  );
  grid.append(row);

  const row2 = el("div", "rule-row");
  row2.append(el("div", "rule-row-title", t("bpTitle")));
  row2.append(
    cell(
      "AVALANCHE",
      t("bpAvalanche"),
      t("bpAvalancheRisk"),
      [srcById(data, "snow-whitepaper")].filter(Boolean) as SourceEntry[]
    )
  );
  row2.append(
    cell(
      "POLYGON PoS",
      t("bpPolygon", { pool: String(poolSize) }),
      t("bpPolygonRisk", { n: nProd, total: pxN }),
      [srcById(data, "heimdall-v2-veblop"), srcById(data, "bor-rpc")].filter(Boolean) as SourceEntry[]
    )
  );
  grid.append(row2);

  const row3 = el("div", "rule-row");
  row3.append(el("div", "rule-row-title", t("puTitle")));
  row3.append(
    cell(
      "AVALANCHE",
      t("puAvalanche"),
      t("puAvalancheRisk"),
      [srcById(data, "avalanchego-upgrade")].filter(Boolean) as SourceEntry[]
    )
  );
  row3.append(
    cell(
      "POLYGON PoS",
      t("puPolygon", { threshold, owners, delay }),
      t("puPolygonRisk"),
      [
        srcById(data, "timelock"),
        srcById(data, "safe-multisig"),
        srcById(data, "stakemanager-proxy-source"),
      ].filter(Boolean) as SourceEntry[]
    )
  );
  grid.append(row3);

  section.append(grid);

  if (safe) {
    const safeLine = el("p", "fine-print");
    safeLine.textContent = `Gnosis Safe ${shortAddr(safe.address)} — ${safe.threshold}-of-${safe.owners_count} · TimelockController ${shortAddr(
      snap.networks.authority!.polygon_l1.timelock.address
    )} · getMinDelay() = ${snap.networks.authority!.polygon_l1.timelock.min_delay_seconds}s`;
    section.append(safeLine);
  }
}

/* ---------------- history ---------------- */

function renderHistory(section: HTMLElement, data: SiteData): void {
  section.append(el("h2", "section-title", t("historyTitle")));
  const pts = data.history;

  const mk = (
    title: string,
    get: (e: NonNullable<typeof pts[0]>) => number | null | undefined,
    fmt: (v: number) => string
  ) => {
    const tile = el("div", "hist-tile");
    tile.append(el("div", "stat-label", title));
    const chart = el("div", "hist-chart");
    const series = pts
      .map((e) => ({ t: e.t, v: get(e) }))
      .filter((p): p is { t: string; v: number } => typeof p.v === "number");
    const ok = renderSparkline(chart, series, fmt);
    tile.append(chart);
    if (!ok) tile.append(el("div", "stat-sub", "—"));
    return tile;
  };

  const rowA = el("div", "hist-row");
  rowA.append(el("div", "hist-chain", "AVALANCHE"));
  rowA.append(mk(t("seriesValidators"), (e) => e.avalanche?.active_validators, (v) => num(v)));
  rowA.append(mk(t("seriesTop10"), (e) => e.avalanche?.top10_share, (v) => pct(v)));
  rowA.append(mk(t("seriesNc"), (e) => e.avalanche?.n_33, (v) => num(v)));

  const rowP = el("div", "hist-row");
  rowP.append(el("div", "hist-chain", "POLYGON PoS"));
  rowP.append(mk(t("seriesValidators"), (e) => e.polygon_pos?.active_validators, (v) => num(v)));
  rowP.append(mk(t("seriesTop10"), (e) => e.polygon_pos?.top10_share, (v) => pct(v)));
  rowP.append(mk(t("seriesNc"), (e) => e.polygon_pos?.n_33, (v) => num(v)));

  section.append(rowA, rowP);
  section.append(el("p", "fine-print", t("historyNote")));
}

/* ---------------- sources ---------------- */

function renderSources(section: HTMLElement, data: SiteData): void {
  section.append(el("h2", "section-title", t("sourcesTitle")));
  const root = data.sources as Record<string, SourceEntry[]>;
  const list = el("ul", "source-list");
  for (const [group, entries] of Object.entries(root)) {
    if (!Array.isArray(entries)) continue;
    for (const s of entries) {
      const li = el("li");
      const a = el("a", "", s.label);
      a.href = s.url;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      li.append(a);
      list.append(li);
    }
    void group;
  }
  section.append(list);
}

/* ---------------- home ---------------- */

function chainViews(snap: Snapshot): ChainView[] {
  const out: ChainView[] = [];
  const av = snap.networks.avalanche;
  if (av) {
    out.push({
      id: "avalanche",
      name: "Avalanche",
      shortName: "Avalanche",
      validators: av.metrics.active_validators,
      top10: av.metrics.top10_share,
      n33: av.metrics.nakamoto.n_33,
      selection: t("selectAvalanche"),
      upgrade: t("upgradeHomeAvalanche"),
    });
  }
  const px = snap.networks.polygon_pos;
  if (px) {
    const safe = snap.networks.authority?.polygon_l1.safe;
    const delay = snap.networks.authority?.polygon_l1.timelock.min_delay_seconds;
    const pool = px.bor.vote_tally_top.length || px.bor.producer_set_limit;
    const upgrade =
      safe?.threshold != null && safe.owners_count != null && delay != null
        ? t("upgradeHomePolygon", {
            threshold: safe.threshold,
            owners: safe.owners_count,
            delay,
          })
        : "—";
    out.push({
      id: "polygon_pos",
      name: "Polygon PoS",
      shortName: "Polygon",
      validators: px.heimdall.active_validators,
      top10: px.heimdall.top10_share,
      n33: px.heimdall.nakamoto.n_33,
      selection: t("selectPolygon", { pool }),
      upgrade,
    });
  }
  return out;
}

function conclusionText(views: ChainView[]): string {
  if (views.length === 0) return "";
  const ranked = [...views].sort((a, b) => b.top10 - a.top10);
  const hi = ranked[0];
  const lo = ranked[ranked.length - 1];
  if (views.length < 2) return `${hi.shortName} · ${t("rowTop10")} ${pct(hi.top10)}`;
  if (hi.top10 === lo.top10) return t("conclusionTie", { share: pct(hi.top10) });
  // A few points of stake share is not a stronger-control claim.
  if (hi.top10 - lo.top10 < 0.05) {
    return t("conclusionClose", {
      chain: hi.shortName,
      share: pct(hi.top10),
      other: lo.shortName,
      otherShare: pct(lo.top10),
    });
  }
  return t("conclusionLead", { chain: hi.shortName });
}

function iconLink(href: string, label: string, viewBox: string, path: string): HTMLAnchorElement {
  const a = el("a", "icon-link");
  a.href = href;
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  a.setAttribute("aria-label", label);
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", viewBox);
  svg.setAttribute("width", "15");
  svg.setAttribute("height", "15");
  svg.setAttribute("aria-hidden", "true");
  const p = document.createElementNS("http://www.w3.org/2000/svg", "path");
  p.setAttribute("fill", "currentColor");
  p.setAttribute("d", path);
  svg.append(p);
  a.append(svg);
  return a;
}

const GITHUB_PATH =
  "M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8z";
const X_PATH =
  "M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.401-7.046-6.18 7.046H2.033l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z";

function renderHomeTable(parent: HTMLElement, data: SiteData, views: ChainView[]): void {
  const verified = data.latest.generated_at;
  const both = [
    srcById(data, "avax-pchain-validators"),
    srcById(data, "heimdall-validators-set"),
  ].filter(Boolean) as SourceEntry[];
  const table = el("table", "cmp-table home-table");
  const head = el("tr");
  head.append(el("th", "col-metric", t("metric")));
  for (const view of views) head.append(el("th", "col-chain", view.name));
  const thead = el("thead");
  thead.append(head);
  const tbody = el("tbody");

  const add = (
    label: string,
    values: string[],
    explain: () => ExplainContent,
    note?: string
  ) => {
    const tr = el("tr");
    const th = el("th", "row-label");
    th.append(document.createTextNode(label));
    if (note) th.append(el("div", "cell-sub", note));
    tr.append(th);
    for (const value of values) tr.append(el("td", "", value));
    bindExplain(tr, explain);
    tbody.append(tr);
  };

  add(
    t("rowValidators"),
    views.map((v) => num(v.validators)),
    () => explainFrom("rowValidators", "mValidatorsWhat", "mValidatorsHow", "mValidatorsLimits", both, verified)
  );
  add(
    t("rowTop10"),
    views.map((v) => pct(v.top10)),
    () => explainFrom("rowTop10", "mTop10What", "mTop10How", "mTop10Limits", both, verified)
  );
  add(
    t("rowN33"),
    views.map((v) => num(v.n33)),
    () =>
      explainFrom(
        "rowNakamoto",
        "mNakamotoWhat",
        "mNakamotoHow",
        "mNakamotoLimits",
        [srcById(data, "cometbft-thresholds"), srcById(data, "snow-whitepaper")].filter(Boolean) as SourceEntry[],
        verified
      )
  );
  add(
    t("rowSelect"),
    views.map((v) => v.selection),
    () =>
      explainFrom(
        "rowBlockProd",
        "mBlockWhat",
        "mBlockHow",
        "mBlockLimits",
        [srcById(data, "heimdall-v2-veblop"), srcById(data, "snow-whitepaper")].filter(Boolean) as SourceEntry[],
        verified
      ),
    t("rowSelectScope")
  );
  add(
    t("rowUpgradeHome"),
    views.map((v) => v.upgrade),
    () =>
      explainFrom(
        "rowUpgrade",
        "mUpgradeWhat",
        "mUpgradeHow",
        "mUpgradeLimits",
        [srcById(data, "timelock"), srcById(data, "safe-multisig"), srcById(data, "avalanchego-upgrade")].filter(
          Boolean
        ) as SourceEntry[],
        verified
      )
  );

  table.append(thead, tbody);
  parent.append(table);
}

function renderBars(parent: HTMLElement, views: ChainView[]): void {
  const maxTop = Math.max(...views.map((v) => v.top10));
  const uniqueLeader = views.filter((v) => v.top10 === maxTop).length === 1;
  const head = el("div", "bars-head");
  head.append(el("div", "bars-label", t("barsLabel")));
  head.append(el("div", "bars-scale", t("barsScale")));
  const wrap = el("div", "bars");
  for (const view of views) {
    const row = el("div", "bar-row");
    row.append(el("div", "bar-name", view.name));
    const track = el("div", "bar-track");
    track.setAttribute("role", "img");
    track.setAttribute("aria-label", `${view.name} ${pct(view.top10)}`);
    const fill = el("span", view.top10 === maxTop && uniqueLeader ? "bar-fill higher" : "bar-fill");
    fill.style.width = `${Math.min(100, view.top10 * 100)}%`;
    track.append(fill);
    row.append(track, el("div", "bar-value", pct(view.top10)));
    wrap.append(row);
  }
  parent.append(head, wrap);
}

/* ---------------- root ---------------- */

export function renderApp(
  root: HTMLElement,
  data: SiteData,
  onToggleLang: (lang: Lang) => void,
  lang: Lang
): void {
  root.replaceChildren();
  const latest = data.latest;
  const views = chainViews(latest);

  const header = el("header", "site-header");
  const hgroup = el("div", "header-group");
  hgroup.append(el("h1", "site-title", t("title")));
  hgroup.append(el("p", "site-subtitle", t("subtitle")));
  const controls = el("div", "header-controls");
  controls.append(
    iconLink(GITHUB_URL, "GitHub", "0 0 16 16", GITHUB_PATH),
    iconLink(X_URL, "X", "0 0 24 24", X_PATH)
  );
  const langBtn = el("button", "lang-btn", t("langLabel"));
  langBtn.addEventListener("click", () => onToggleLang(lang === "en" ? "zh" : "en"));
  controls.append(langBtn);
  header.append(hgroup, controls);
  root.append(header);

  root.append(el("p", "conclusion", conclusionText(views)));
  if (views.length > 0) root.append(el("p", "conclusion-scope", t("conclusionScope")));
  renderBars(root, views);
  renderHomeTable(root, data, views);

  const details = el("details", "evidence");
  const summary = el("summary", "", t("detailsSummary"));
  const body = el("div", "evidence-body");

  const addLayer = (title: string, fill: (layer: HTMLElement) => void) => {
    const layer = el("details", "evidence-layer");
    layer.append(el("summary", "", title));
    const layerBody = el("div", "evidence-layer-body");
    fill(layerBody);
    layer.append(layerBody);
    body.append(layer);
  };

  addLayer(t("evValidators"), (layer) => {
    const hero = el("section", "hero");
    if (latest.networks.avalanche) {
      const panelA = el("div", "chain-panel");
      renderAvalanchePanel(panelA, data);
      hero.append(panelA);
    }
    if (latest.networks.polygon_pos) {
      const panelP = el("div", "chain-panel");
      renderPolygonPanel(panelP, data);
      hero.append(panelP);
    }
    layer.append(hero);
  });

  addLayer(t("evEntity"), (layer) => {
    const entity = el("p", "fine-print", `${t("rowEntity")}: ${t("entityUnknown")}`);
    bindExplain(entity, () => ({
      title: t("rowEntity"),
      what: t("mEntityWhat"),
      how: t("mEntityHow"),
      sources: [{ label: "methodology.json", url: "./data/methodology.json" }],
      limits: t("mEntityLimits"),
      verified: latest.generated_at,
    }));
    layer.append(entity);
  });

  addLayer(t("evControl"), (layer) => {
    const tableSec = el("section", "section");
    renderTable(tableSec, data);
    const rulesSec = el("section", "section");
    renderRules(rulesSec, data);
    layer.append(tableSec, rulesSec);
  });

  addLayer(t("evHistory"), (layer) => {
    const histSec = el("section", "section");
    renderHistory(histSec, data);
    layer.append(histSec);
  });

  addLayer(t("evSources"), (layer) => {
    const srcSec = el("section", "section");
    renderSources(srcSec, data);
    const method = el("p", "fine-print");
    const methodLink = el("a", "", t("methodologyLink"));
    methodLink.href = "./data/methodology.json";
    methodLink.target = "_blank";
    methodLink.rel = "noopener noreferrer";
    method.append(methodLink);
    layer.append(srcSec, method, el("p", "fine-print", t("footerNote")));
  });

  details.append(summary, body);
  root.append(details);

  const attempt = data.lastAttempt;
  const status = attempt?.status ?? latest.status;
  const statusKey = status === "error" ? "statusError" : status === "partial" || status !== "ok" ? "statusPartial" : "statusOk";
  const updated = el(
    "p",
    "updated-line",
    `${t("updatedAt", { t: utcTime(latest.generated_at) })} · ${fmtAge(latest.generated_at)} · ${t(statusKey)}`
  );
  root.append(updated);
  if (attempt && attempt.status !== "ok") {
    const reasons = [
      ...Object.entries(attempt.errors).map(([k, v]) => `${k}: ${v}`),
      ...Object.values(attempt.anomalies).flat(),
    ];
    if (reasons.length) {
      root.append(el("p", "updated-line", t("staleReason", { reason: reasons.join(" · ") })));
    }
  }
}
