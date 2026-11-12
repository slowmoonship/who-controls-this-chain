// Types mirroring data/latest.json (schema_version 1).

export interface Nakamoto {
  n_33: number;
  n_50: number;
}

export interface AvalancheMetrics {
  active_validators: number;
  total_weight: string;
  weight_unit: string;
  delegated_weight: string;
  top10_share: number;
  max_share: number;
  nakamoto: Nakamoto;
}

export interface ValidatorRow {
  node_id?: string;
  val_id?: string;
  signer?: string;
  weight?: string;
  voting_power?: string;
  share: number;
  name?: string;
  uptime?: string;
  delegator_weight?: string;
}

export interface AvalancheNetwork {
  network: string;
  name: string;
  collect_status?: string;
  carried_forward?: boolean;
  validation_warnings?: string[];
  chain_heights: { p_chain_height?: string };
  metrics: AvalancheMetrics;
  top10: ValidatorRow[];
  weights_sorted_desc: string[];
  block_production: {
    comparable_to_bor_spans: boolean;
    mechanism: string;
    note: string;
  };
}

export interface ProducerRow {
  val_id: string;
  signer: string;
  voting_power: string;
  name?: string;
}

export interface SpanRow {
  id: number;
  start_block: number;
  end_block: number;
  producers: ProducerRow[];
}

export interface PolygonHeimdall {
  active_validators: number;
  total_voting_power: string;
  top10_share: number;
  max_share: number;
  nakamoto: Nakamoto;
}

export interface PolygonBor {
  params: { sprint_duration: number; span_duration: number; producer_count: number };
  current_span: SpanRow;
  recent_spans: SpanRow[];
  producer_set_limit: number;
  vote_tally_top: { val_id: string; score: string }[];
  fallback_producers_client_constant: string;
  blocks_by_producer_recent: Record<string, number>;
  block_coverage_n_50: number | null;
  bor_crosscheck: Record<string, unknown>;
}

export interface PolygonNetwork {
  network: string;
  name: string;
  collect_status?: string;
  carried_forward?: boolean;
  validation_warnings?: string[];
  chain_heights: { heimdall_height?: string };
  heimdall: PolygonHeimdall;
  top10: ValidatorRow[];
  validators_all?: ValidatorRow[];
  bor: PolygonBor;
  hardfork_heights_mainnet: Record<string, number>;
}

export interface SafeInfo {
  address: string;
  threshold: number | null;
  owners_count: number | null;
  owners: string[];
  note: string;
}

export interface TimelockInfo {
  address: string;
  type: string;
  min_delay_seconds: number | null;
  deployer: string;
  roles: Record<string, unknown>;
  live_role_checks: Record<string, boolean>;
}

export interface Authority {
  polygon_l1: {
    contracts: Record<
      string,
      { address: string; implementation: string | null; owner: string | null }
    >;
    safe: SafeInfo;
    timelock: TimelockInfo;
    sources: { id: string; label: string; url: string; kind: string }[];
  };
  polygon_heimdall: { params_authority: string; hardforks: string };
  avalanche: {
    mechanism: string;
    latest_named_upgrades_mainnet: Record<string, string>;
    sources: { id: string; label: string; url: string; kind: string }[];
  };
}

export interface Snapshot {
  schema_version: number;
  generated_at: string;
  status: string;
  warnings: string[];
  networks: {
    avalanche?: AvalancheNetwork;
    polygon_pos?: PolygonNetwork;
    authority?: Authority;
  };
}

export interface HistoryEntry {
  file: string;
  t: string;
  status: string;
  avalanche?: {
    active_validators?: number | null;
    top10_share?: number | null;
    n_33?: number | null;
  };
  polygon_pos?: {
    active_validators?: number | null;
    top10_share?: number | null;
    n_33?: number | null;
    span_id?: number | null;
    producers?: number | null;
  };
}

export interface LastAttempt {
  attempted_at: string;
  status: string;
  errors: Record<string, string>;
  anomalies: Record<string, string[]>;
  warnings: string[];
}

export interface SiteData {
  latest: Snapshot;
  history: HistoryEntry[];
  sources: Record<string, unknown>;
  methodology: Record<string, unknown>;
  lastAttempt: LastAttempt | null;
}
