export type Lang = "en" | "zh";

type Dict = Record<string, string>;

const en: Dict = {
  title: "Who Controls This Chain?",
  subtitle: "Who really controls the blockchain?",
  tagline:
    "Two chains, two power structures. Not how many validators exist — how few actors it takes to control the things that matter.",
  lastUpdated: "Last updated",
  dataFrom: "Data from",
  viewIn: "View in",
  langLabel: "中文",
  statusOk: "All collections healthy",
  statusPartial: "Some collections failed — showing last valid data",
  statusError: "Collection failing — data may be stale",
  carriedForward: "carried forward from previous snapshot",
  validators: "Active validators",
  validatorsNote: "consensus-layer active set",

  // Polygon hero
  polyHeroLine: "Validators ≠ Block producers",
  producersNow: "Block producers this span",
  electedPool: "Elected producer pool",
  ofValidators: "of active validators",
  spanId: "Span",
  blockRange: "Bor block range",
  spanLength: "blocks per span",
  producerMech: "One producer per span, rotating round-robin over the elected pool",
  producerCaveat:
    "The span producer orders & censors transactions within this span only. It cannot finalize history, change protocol rules, or move user funds alone. Checkpoints & milestones need 2/3+ of validator voting power on Heimdall.",
  votesNote:
    "Candidate pool from stake-weighted validator votes (veBlop). Recorded votes currently match the heimdalld client's built-in fallback list — displayed as observed, not as proof of intent.",

  // Avalanche hero
  avaxHeroLine: "No fixed block producers",
  avaxProdNote:
    "Different consensus model: blocks are proposed by stake-sampled leaders (Snowman++). Every validator can propose in proportion to its stake.",
  top10ByWeight: "Top 10 by stake weight",
  otherValidators: "Other validators",
  currentProducer: "Current span producer",
  poolMember: "Elected pool member",
  dotsOrdered: "dots ordered by stake weight, descending",
  delegated: "of stake is delegated",

  // Table
  comparisonTitle: "Power concentration, side by side",
  metric: "Metric",
  avalanche: "Avalanche",
  polygonPos: "Polygon PoS",
  rowValidators: "Active validators",
  rowTop10: "Top 10 stake share",
  rowMax: "Largest validator share",
  rowNakamoto: "Nakamoto-style concentration",
  rowNakamotoUnit: "validators to reach 33% / 50% of weight",
  rowBlockProd: "Block production",
  rowUpgrade: "Protocol upgrades",
  diffModel: "Different consensus model",
  blockProdAvalanche: "stake-sampled leaders, no fixed producer set",
  blockProdPolygon: "1 producer/span · elected pool of {pool}",
  upgradeAvalanche: "client software releases + validator adoption (no admin key)",
  upgradePolygon: "5-of-9 Safe + 0s timelock owns upgradeable staking contracts",
  ncCaveat:
    "Weight-concentration statistics, not attack thresholds. CometBFT (Heimdall) and Snowman (Avalanche) convert weight control into capabilities differently — see methodology.",

  // Rules section
  rulesTitle: "Who can change the rules?",
  rulesSub: "Consensus control · Block production · Protocol upgrades",
  rcTitle: "Consensus control",
  bpTitle: "Block production",
  puTitle: "Protocol upgrades",
  riskLabel: "Risk",
  evidenceLabel: "Evidence",

  rcAvalanche:
    "Snowman-family consensus over 542 stake-weighted validators; finality follows repeated stake-sampled voting. No fixed committee.",
  rcAvalancheRisk:
    "Weight is fairly spread today (top 10 ≈ 19%), but consensus safety still degrades probabilistically as any single stake bloc grows.",
  rcPolygon:
    "Heimdall v2 runs CometBFT over 100 validators. >1/3 of voting power can halt finality; >2/3 can finalize conflicting state. Top 10 hold ≈66% of power.",
  rcPolygonRisk:
    "4 validators already reach 33%; 7 reach 50%. Small coordinated groups can halt checkpoints/milestones.",
  bpAvalanche:
    "No span-style producer role. Leaders are sampled proportional to stake across all validators.",
  bpAvalancheRisk:
    "A large validator proposes more often but can only censor briefly; history finalizes through whole-set voting.",
  bpPolygon:
    "veBlop: validators elect a pool (stake-weighted votes), then exactly one producer serves each 6400-block span, round-robin. Observed pool right now: {pool} signers.",
  bpPolygonRisk:
    "Within its span one producer fully orders Bor blocks. Rotation limits the window (~3.6 h) but concentration is extreme: 1% of validators produce 100% of blocks in-span.",
  puAvalanche:
    "Named upgrades (Apricot→Helicon) activate at timestamps compiled into avalanchego. Validators must adopt the new binary; no on-chain admin key exists.",
  puAvalancheRisk:
    "No multisig ≠ no risk: influence concentrates in client development (Ava Labs) and release coordination. Un-upgraded validators simply fall off.",
  puPolygon:
    "L1 staking/bridge contracts sit behind UpgradableProxies owned by a TimelockController. The timelock's proposer+executor is a 5-of-9 Gnosis Safe; getMinDelay() = 0 s. Heimdall params need x/gov; hardfork heights ship in client binaries.",
  puPolygonRisk:
    "5 of 9 signers can upgrade StakeManager/RootChain logic with no waiting period — in principle rewriting staking/withdrawal or checkpoint-verification rules. Not a key over user wallets, but a major control point.",

  // Explain dialog
  explainTitle: "How this metric works",
  whatItIs: "What it is",
  howComputed: "How it is computed",
  sourceLabel: "Data source",
  limitsLabel: "Limits",
  updatedLabel: "Last verified",
  methodologyLink: "Full methodology (methodology.json)",
  close: "Close",

  // History
  historyTitle: "Since collection started",
  historyNote: "Snapshots accumulate every 6 hours. Charts appear once two snapshots exist.",
  seriesValidators: "Active validators",
  seriesTop10: "Top-10 stake share",
  seriesNc: "Validators to reach 33%",

  // Footer
  sourcesTitle: "Sources & evidence",
  footerNote:
    "Every figure links to a public endpoint, contract, or code reference. Open source · auto-updated from on-chain data · no database, no backend.",
  staleBanner: "Showing data from {t} ({age}).",
  staleReason: "Reason: {reason}",
  updatedAt: "Updated {t}",
  heroVal: "Validators",
  heroVal1: "Validator",
  heroProd: "Block Producers",
  heroProd1: "Block Producer",
  heroFixed: "Fixed Block Producers",
  heroFixed1: "Fixed Block Producer",
  poolSub: "{n} of {total} validators",
  producerRatio:
    "Producers are {share} of the validator set ({n} of {total}) and produce 100% of blocks in span #{span}",
  ncTileLabel: "Nakamoto (33% / 50%)",

  // Per-metric explain texts
  mValidatorsWhat: "How many validators are in the network's active consensus set right now.",
  mValidatorsHow:
    "Avalanche: length of platform.getCurrentValidators (Primary Network; weight already includes delegations). Polygon: length of Heimdall /stake/validators-set.",
  mValidatorsLimits:
    "Counts validator records, not independent organizations. One entity may run several validators; some validators are run for exchange staking products.",

  mTop10What: "Combined stake-weight share of the ten largest validators.",
  mTop10How: "sum of the 10 largest weights ÷ total active weight. Avalanche weight = own stake + delegations (nAVAX). Polygon = Heimdall voting power (staked POL / 10^15).",
  mTop10Limits: "Weight share is not organization share — see active validators' entity caveat.",

  mMaxWhat: "Share of total active weight held by the single largest validator.",
  mMaxHow: "max(weight) ÷ total weight.",
  mMaxLimits: "Same entity caveat: one validator record ≠ one organization.",

  mNakamotoWhat:
    "Minimum number of the largest validators whose combined weight reaches 33% (and 50%) of total weight.",
  mNakamotoHow:
    "Sort weights descending; count entries until the cumulative share crosses the threshold. Formula and recomputation data are in methodology.json / the snapshot's weights_sorted_desc.",
  mNakamotoLimits:
    "A weight-concentration statistic, NOT an attack threshold. CometBFT turns >1/3 into 'can halt finality' and >2/3 into 'can finalize conflicting state'; Snowman's bounds are probabilistic and not directly comparable.",

  mBlockWhat: "Who actually produces execution-layer blocks, and how they are chosen.",
  mBlockHow:
    "Polygon: Heimdall veBlop — validators vote for producers (stake-weighted positional tally, pool limit 4); each 6400-block span freezes exactly one producer, round-robin. Read live from /bor/spans/latest and /bor/spans/{id}. Avalanche: stake-sampled leaders (Snowman++), no fixed producer set.",
  mBlockLimits:
    "A span producer controls ordering/censorship within its span only (~3.6 h). It cannot finalize history, change rules, or move funds alone. The current producer set is per-span — not the only validators that can ever produce.",

  mUpgradeWhat: "Which mechanism changes protocol rules and contract logic, and who controls it.",
  mUpgradeHow:
    "Polygon: on-chain reads of proxy slots, Gnosis Safe getThreshold/getOwners and TimelockController getMinDelay/hasRole on Ethereum mainnet (re-verified every collection), plus heimdalld hardfork heights from client source. Avalanche: avalanchego upgrade/upgrade.go activation timestamps (software, not keys).",
  mUpgradeLimits:
    "Contract upgrade authority is not a key over user wallets. Multisig 'owners' are addresses — real-world identities are not verified. Software-upgrade influence is social/technical, not an on-chain threshold.",

  mEntityWhat: "Concentration after mapping validators to the organizations that operate them.",
  mEntityHow:
    "Not computed: there is no authoritative validator→entity registry for either network. Operator-declared names (Polygon staking API) are display-only.",
  mEntityLimits:
    "Name or address similarity is not evidence of common control. Reported as Unknown rather than guessed.",
};

const zh: Dict = {
  title: "谁控制这条链？",
  subtitle: "Who really controls the blockchain?",
  tagline: "两条链，两种权力结构。关键不是有多少验证者，而是多少主体联合起来就能控制关键权力。",
  lastUpdated: "最后更新",
  dataFrom: "数据来源",
  viewIn: "语言",
  langLabel: "EN",
  statusOk: "采集正常",
  statusPartial: "部分采集失败 — 显示最近一次有效数据",
  statusError: "采集持续失败 — 数据可能过期",
  carriedForward: "沿用上一次快照",
  validators: "活跃验证者",
  validatorsNote: "共识层活跃集合",

  polyHeroLine: "验证者 ≠ 出块者",
  producersNow: "本 span 出块者",
  electedPool: "当选出块者池",
  ofValidators: "占活跃验证者",
  spanId: "Span",
  blockRange: "Bor 区块范围",
  spanLength: "每 span 区块数",
  producerMech: "每个 span 仅 1 名出块者，在当选池内轮换",
  producerCaveat:
    "span 出块者只能在本 span 内排序与审查交易。它无法单独最终确认历史、修改协议规则或转移用户资金。检查点与里程碑需要 Heimdall 上 2/3+ 投票权重。",
  votesNote:
    "候选池来自质押加权的验证者投票（veBlop）。当前记录的投票与 heimdalld 客户端内置回退列表一致 — 如实展示，不推断其动机。",

  avaxHeroLine: "无固定出块者集合",
  avaxProdNote:
    "共识模型不同（Different consensus model）：区块由按质押权重抽样的领导者提出（Snowman++），每个验证者都可按权重出块。",
  top10ByWeight: "质押权重前 10",
  otherValidators: "其他验证者",
  currentProducer: "当前 span 出块者",
  poolMember: "当选池成员",
  dotsOrdered: "圆点按质押权重降序排列",
  delegated: "的质押来自委托",

  comparisonTitle: "权力集中度对照",
  metric: "指标",
  avalanche: "Avalanche",
  polygonPos: "Polygon PoS",
  rowValidators: "活跃验证者",
  rowTop10: "前 10 质押占比",
  rowMax: "最大验证者占比",
  rowNakamoto: "中本聪系数（集中度口径）",
  rowNakamotoUnit: "达到 33% / 50% 权重所需验证者数",
  rowBlockProd: "出块机制",
  rowUpgrade: "协议升级",
  diffModel: "共识模型不同",
  blockProdAvalanche: "按质押抽样领导者，无固定出块者集合",
  blockProdPolygon: "每 span 1 名出块者 · 当选池 {pool} 人",
  upgradeAvalanche: "客户端软件发布 + 验证者升级（无管理员密钥）",
  upgradePolygon: "5/9 多签 + 0 秒 Timelock 控制可升级质押合约",
  ncCaveat:
    "这是权重集中度统计，不是攻击阈值。CometBFT（Heimdall）与 Snowman（Avalanche）将权重控制转化为实际能力的方式不同 — 见方法论。",

  rulesTitle: "谁能改变规则？",
  rulesSub: "共识控制 · 出块 · 协议升级",
  rcTitle: "共识控制",
  bpTitle: "出块",
  puTitle: "协议升级",
  riskLabel: "风险",
  evidenceLabel: "证据",

  rcAvalanche:
    "Snowman 系共识由 542 个按质押加权的验证者参与，最终性来自反复的抽样投票。没有固定委员会。",
  rcAvalancheRisk:
    "当前权重分布较分散（前 10 约 19%），但任何单一质押集团增大都会概率性削弱共识安全。",
  rcPolygon:
    "Heimdall v2 在 100 个验证者上运行 CometBFT。>1/3 投票权重可阻断最终性；>2/3 可最终确认互相冲突的状态。前 10 掌握约 66% 权重。",
  rcPolygonRisk: "4 个验证者即达 33%，7 个达 50%。小规模协调即可阻断检查点/里程碑。",
  bpAvalanche: "没有 span 式出块者角色。领导者按质押权重在全体验证者中抽样。",
  bpAvalancheRisk: "大验证者出块更频繁，但只能短暂审查；历史由全体投票最终确认。",
  bpPolygon:
    "veBlop：验证者投票选出候选池（质押加权），之后每 6400 个区块的 span 由恰好 1 名出块者轮流出块。当前观察到的池：{pool} 个签名者。",
  bpPolygonRisk:
    "在 span 内，单一出块者完全控制 Bor 区块排序。轮换限制了窗口（约 3.6 小时），但集中度极端：1% 的验证者产出 span 内 100% 的区块。",
  puAvalanche:
    "命名升级（Apricot→Helicon）以编译进 avalanchego 的时间戳激活。验证者必须升级二进制；不存在链上管理员密钥。",
  puAvalancheRisk:
    "「没有多签」≠「没有中心化风险」：影响力集中在客户端开发（Ava Labs）与发布协调。未升级的验证者会掉队。",
  puPolygon:
    "L1 质押/跨链合约位于 UpgradableProxy 之后，proxy owner 是 TimelockController。Timelock 的 proposer+executor 是 5/9 Gnosis Safe；getMinDelay() = 0 秒。Heimdall 参数需 x/gov；硬分叉高度编译在客户端二进制中。",
  puPolygonRisk:
    "9 个签名者中的 5 个即可无等待期升级 StakeManager/RootChain 逻辑 — 原则上可改写质押/提现或检查点验证规则。它不是用户钱包的密钥，但仍是关键控制点。",

  explainTitle: "指标说明",
  whatItIs: "指标是什么",
  howComputed: "如何计算",
  sourceLabel: "数据来源",
  limitsLabel: "局限性",
  updatedLabel: "最近核验",
  methodologyLink: "完整方法论（methodology.json）",
  close: "关闭",

  historyTitle: "自采集启动以来",
  historyNote: "每 6 小时累积快照。存在两个以上快照后显示趋势图。",
  seriesValidators: "活跃验证者",
  seriesTop10: "前 10 质押占比",
  seriesNc: "达到 33% 所需验证者数",

  sourcesTitle: "来源与证据",
  footerNote:
    "每个数字都链接到公开端点、合约或代码引用。开源 · 链上数据自动更新 · 无数据库、无后端。",
  staleBanner: "当前显示 {t} 的数据（{age}）。",
  staleReason: "原因：{reason}",
  updatedAt: "更新于 {t}",
  heroVal: "验证者",
  heroVal1: "验证者",
  heroProd: "出块者",
  heroProd1: "出块者",
  heroFixed: "固定出块者",
  heroFixed1: "固定出块者",
  poolSub: "{total} 个验证者中的 {n} 个",
  producerRatio: "{n} 名出块者 = 验证者集合的 {share}，产出 span #{span} 内 100% 的区块",
  ncTileLabel: "中本聪系数（33% / 50%）",

  mValidatorsWhat: "当前网络共识层活跃集合中的验证者数量。",
  mValidatorsHow:
    "Avalanche：platform.getCurrentValidators 返回条数（主网；weight 已含委托）。Polygon：Heimdall /stake/validators-set 条数。",
  mValidatorsLimits:
    "统计的是验证者记录，不是独立机构数量。一个主体可运营多个验证者；部分验证者由交易所质押产品运营。",

  mTop10What: "最大的 10 个验证者合计的质押权重占比。",
  mTop10How: "前 10 大权重之和 ÷ 总活跃权重。Avalanche 权重 = 自有质押 + 委托（nAVAX）。Polygon = Heimdall 投票权重（质押 POL ÷ 10^15）。",
  mTop10Limits: "权重占比不等于机构占比 — 实体识别的局限同样适用。",

  mMaxWhat: "最大单个验证者占总活跃权重的比例。",
  mMaxHow: "最大权重 ÷ 总权重。",
  mMaxLimits: "同样的实体局限：一个验证者记录 ≠ 一个机构。",

  mNakamotoWhat: "最大的若干验证者合计权重达到总权重 33%（及 50%）所需的最少数量。",
  mNakamotoHow:
    "权重降序排列，累计占比越过阈值时的个数。公式与复算数据见 methodology.json 与快照中的 weights_sorted_desc。",
  mNakamotoLimits:
    "这是权重集中度统计，不是攻击阈值。CometBFT 中 >1/3 可阻断最终性、>2/3 可确认冲突状态；Snowman 的安全界限是概率性的，不能直接对等换算。",

  mBlockWhat: "谁实际产出执行层区块，以及他们如何被选出。",
  mBlockHow:
    "Polygon：Heimdall veBlop — 验证者投票（质押加权位置计票，池上限 4），每个 6400 区块的 span 冻结恰好 1 名出块者并轮换。实时读取 /bor/spans/latest 与 /bor/spans/{id}。Avalanche：按质押抽样领导者（Snowman++），无固定出块者集合。",
  mBlockLimits:
    "span 出块者只控制本 span 内的排序/审查（约 3.6 小时），无法单独最终确认历史、修改规则或转移资金。当前出块者集合是每 span 的，不代表永远只有这些验证者能出块。",

  mUpgradeWhat: "通过什么机制修改协议规则与合约逻辑，由谁控制。",
  mUpgradeHow:
    "Polygon：在以太坊主网读取代理存储槽、Gnosis Safe getThreshold/getOwners、TimelockController getMinDelay/hasRole（每次采集重新核验），并从客户端源码核对 heimdalld 硬分叉高度。Avalanche：avalanchego upgrade/upgrade.go 的激活时间戳（软件而非密钥）。",
  mUpgradeLimits:
    "合约升级权限不是用户钱包的密钥。多签「所有者」是地址 — 真实身份未经核实。客户端升级影响力是社会/技术层面的，不是链上阈值。",

  mEntityWhat: "把验证者映射到实际运营机构后的集中度。",
  mEntityHow:
    "未计算：两个网络都不存在权威的验证者→机构映射。运营方自报名称（Polygon staking API）仅用于展示。",
  mEntityLimits: "名称或地址相似不构成同一控制权的证据。无法可靠识别时显示 Unknown，不做猜测。",
};

const dicts: Record<Lang, Dict> = { en, zh };

let current: Lang = "en";

export function setLang(lang: Lang): void {
  current = lang;
}

export function getLang(): Lang {
  return current;
}

export function t(key: string, vars?: Record<string, string | number>): string {
  let s = dicts[current][key] ?? dicts.en[key] ?? key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      s = s.replaceAll(`{${k}}`, String(v));
    }
  }
  return s;
}
