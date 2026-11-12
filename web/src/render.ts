// Page assembly. Plain DOM, no framework.

import { renderDotGrid, type DotSpec } from "./dots";
import { renderSparkline } from "./charts";
import { bindExplain, type ExplainContent } from "./explain";
import { t, type Lang } from "./i18n";
import { ageText, num, pct, shortAddr, utcTime } from "./format";
import type { SiteData, Snapshot, ValidatorRow } from "./types";

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
        share: pct(nProd / h.active_validators),
        span: bor.current_span.id,
      })
    )
  );

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
    explain: () => ExplainContent
  ) => {
    const tr = el("tr");
    const th = el("th", "row-label", label);
    const tdA = el("td");
    tdA.append(el("span", "cell-main", a));
    const tdP = el("td");
    tdP.append(el("span", "cell-main accent-text", p));
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
  const px = snap.networks.polygon_pos;
  const safe = snap.networks.authority?.polygon_l1.safe;
  const poolSize = px ? px.bor.vote_tally_top.length || px.bor.producer_set_limit : 4;

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
      t("rcAvalanche"),
      t("rcAvalancheRisk"),
      [srcById(data, "avax-pchain-validators")].filter(Boolean) as SourceEntry[]
    )
  );
  row.append(
    cell(
      "POLYGON PoS",
      t("rcPolygon"),
      t("rcPolygonRisk"),
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
      t("bpPolygonRisk"),
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
      t("puPolygon"),
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

/* ---------------- root ---------------- */

export function renderApp(
  root: HTMLElement,
  data: SiteData,
  onToggleLang: (lang: Lang) => void,
  lang: Lang
): void {
  root.replaceChildren();

  // Header
  const header = el("header", "site-header");
  const hgroup = el("div", "header-group");
  hgroup.append(
    el("h1", "site-title", t("title")),
    el("p", "site-subtitle", t("subtitle"))
  );
  const controls = el("div", "header-controls");
  const langBtn = el("button", "lang-btn", t("langLabel"));
  langBtn.addEventListener("click", () => onToggleLang(lang === "en" ? "zh" : "en"));
  controls.append(langBtn);
  header.append(hgroup, controls);
  root.append(header);

  root.append(el("p", "tagline", t("tagline")));

  // Status / freshness banner
  const latest = data.latest;
  const attempt = data.lastAttempt;
  const banner = el("div", `status-banner status-${attempt?.status ?? latest.status}`);
  const latestTime = utcTime(latest.generated_at);
  banner.append(
    el("span", "status-text", `${t("updatedAt", { t: latestTime })} · ${t("lastUpdated")}: ${fmtAge(latest.generated_at)} · ${t(
      attempt && attempt.status !== "ok" ? "statusPartial" : "statusOk"
    )}`)
  );
  if (attempt && attempt.status !== "ok") {
    const reasons = [
      ...Object.entries(attempt.errors).map(([k, v]) => `${k}: ${v}`),
      ...Object.values(attempt.anomalies).flat(),
    ];
    if (reasons.length) {
      banner.append(el("div", "status-reason", t("staleReason", { reason: reasons.join(" · ") })));
    }
  }
  for (const w of latest.warnings ?? []) {
    banner.append(el("div", "status-reason", w));
  }
  root.append(banner);

  // Hero panels
  const hero = el("section", "hero");
  const panelA = el("div", "chain-panel");
  const panelP = el("div", "chain-panel");
  if (latest.networks.avalanche) renderAvalanchePanel(panelA, data);
  if (latest.networks.polygon_pos) renderPolygonPanel(panelP, data);
  hero.append(panelA, panelP);
  root.append(hero);

  // Table
  const tableSec = el("section", "section");
  renderTable(tableSec, data);
  root.append(tableSec);

  // Rules
  const rulesSec = el("section", "section");
  renderRules(rulesSec, data);
  root.append(rulesSec);

  // History
  const histSec = el("section", "section");
  renderHistory(histSec, data);
  root.append(histSec);

  // Sources
  const srcSec = el("section", "section");
  renderSources(srcSec, data);
  root.append(srcSec);

  // Footer
  const footer = el("footer", "site-footer");
  footer.append(
    el("p", "fine-print", t("footerNote")),
    el("p", "fine-print", `${t("dataFrom")}: api.avax.network · heimdall-api.polygon.technology · polygon-bor-rpc.publicnode.com · Ethereum mainnet JSON-RPC`)
  );
  root.append(footer);
}
