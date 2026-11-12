# Research Notes — Who Controls This Chain? (verified 2026-11-12)

All facts below were verified with live API calls / on-chain reads / source code on 2026-11-12.
Raw captures in `research/`.

## 1. Avalanche Primary Network

### Data source (verified working)
- RPC: `POST https://api.avax.network/ext/bc/P`, method `platform.getCurrentValidators` (no params
  = Primary Network). Response: `{result: {validators: [...]}}` — **544 validators**, no pagination.
- Validator fields: `txID, startTime, endTime, weight, nodeID, validationRewardOwner,
  delegationRewardOwner, potentialReward, delegationFee, uptime, connected, signer{publicKey},
  delegatorCount, delegatorWeight`.
- **`weight` already includes delegated weight** (verified: `weight - delegatorWeight` = own stake;
  253/544 validators have delegators; sum delegatorWeight = 42,048,500 AVAX vs total 153,332,495
  AVAX). Never add `delegatorWeight` to `weight`. Unit: nAVAX (10^-9 AVAX).
- Observed snapshot (2026-11-12): total weight 153,332,495.348 AVAX; max validator share 1.96%;
  Top-10 share 19.05%.

### Consensus / block production
- Primary Network validates P/X/C chains. C-Chain blocks proposed via Snowman++ proposer-VM
  (stake-weighted leader sampling); P-Chain uses the same Snowman-family consensus. There is **no
  fixed small producer set** like Bor spans → mark "Different consensus model" in comparisons.
- Consensus is stake-sampled metastable (Snow / Snowball / Snowman family; Team Rocket whitepaper).
  Exact adversarial tolerance is probabilistic — **do not assert a single attack threshold**;
  report 33%/50% weight-concentration stats as labeled statistics only.

### Protocol upgrades (verified from avalanchego source `upgrade/upgrade.go`)
- Named network upgrades activate at **wall-clock timestamps compiled into the client binary**:
  Apricot Phase1–Post6, Banff (2022-10-18), Cortina (2023-04-25), Durango (2024-03-06),
  Etna (2024-12-16), Fortuna (2025-04-08), Granite (2025-11-19), Helicon (2026-09-22),
  Igloo = unscheduled (year 9999 sentinel).
- There is **no on-chain admin key** that can upgrade Primary Network consensus rules. Upgrades
  happen by: (a) Ava Labs (dominant client developer) releases avalanchego with new rules +
  activation timestamps; (b) validator operators adopt the new binary. A majority of stake
  running the new software defines the upgraded network; validators that never upgrade fall off.
- "No multisig" ≠ "no centralization risk": client-development influence + validator software
  adoption are the real control points. Secondary clients are limited (Coreth for C-Chain is also
  Ava Labs-maintained).

## 2. Polygon PoS (Heimdall v2 + Bor)

### Heimdall v2 REST (verified working — v1 endpoints are dead)
- Base: `https://heimdall-api.polygon.technology` (gRPC-gateway; legacy `/staking/validators` etc.
  return `{"code":12,"message":"Not Implemented"}`).
- Working routes (from `heimdall-v2/proto/heimdallv2/*/query.proto`, `google.api.http`):
  - `/stake/validators-set` → current active validator set + `total_voting_power`
  - `/stake/total-power`, `/stake/validator/{id}`, `/stake/proposers/current`
  - `/bor/spans/latest`, `/bor/spans/{id}`, `/bor/spans/list`, `/bor/params`,
    `/bor/producer-votes`, `/bor/validator-performance-score`
  - `/chainmanager/params` → L1 contract addresses
  - `/status` → CometBFT sync info (height)
- Observed snapshot (2026-11-12, height ~57,676,337): **100 active validators**, total voting
  power 3,760,237,065 (power = stake_wei / 10^15, verified vs staking-api totalStake);
  max share 11.68%; Top-10 share 65.96%. Heimdall = CometBFT BFT (2/3+ voting power to finalize).

### Bor block production — veBlop (Validator-Elected Block Producer)
- `/bor/params` (live): `sprint_duration=16, span_duration=6400, producer_count=50`.
  ⚠ `producer_count=50` is the legacy selection param; **veBlop elects exactly ONE producer per
  span** (`AddNewVeBlopSpan` → `SelectedProducers: []Validator{newProducer}`).
- Current span #15428: blocks 97,160,256–97,166,655, `selected_producers` = 1 validator
  (val_id 91, 0xe8de70b95a4d105aff6584a722242726016956fe).
- Verified rotation over spans 15420–15428: 91→92→93→94→91→92→93→94→91 (strict round-robin,
  one producer per span, span = 6400 blocks ≈ 3.6 h at ~2 s/block).
- Producer signers (the rotation pool):
  - 91: `0xe8de70b95a4d105aff6584a722242726016956fe`
  - 92: `0x9aa1e7971a94cbc400d95e593e82fb6e79fc99d8`
  - 93: `0x233d596e31ed170da60209fe5701800c6b086cb7`
  - 94: `0x264379c47e653dafa153841a995cf975b6a02ed7`
- Bor execution-layer cross-check: `bor_getCurrentValidators`, `bor_getSigners`, `bor_getAuthor`
  on `https://polygon-bor-rpc.publicnode.com` return exactly the current span's single producer.
  `eth_getBlockByNumber` `miner` is zero (clique-style authorship; not usable).
- **Selection mechanism** (heimdall-v2 `x/bor/keeper/veblop.go`, read 2026-11-12):
  1. Validators cast `MsgVoteProducers` (ordered candidate lists). Visible at `/bor/producer-votes`.
  2. `CalculateProducerSet`: stake-weighted positional tally
     (score += (N − position) × voter_stake) → top `producerSetLimit` candidates.
     `producerSetLimit` = 3 before `SetProducerDowntime` height, **4** after
     (`helper/config.go`: `producerSetLimit=3, newProducerSetLimit=4`).
  3. Empty votes → fallback to **hardcoded** `DefaultMainnetProducers = "91,92,93,94"`
     compiled into the client (`helper/config.go:122`).
  4. `SelectProducer`: round-robin from current producer over the candidate list, skipping
     producers with registered planned downtime.
  5. Each span freezes exactly one producer. Mid-span rotation exists on milestone stall
     (`changeProducerThreshold` 5 → 10, `spanRotationBuffer` 10 → 20).
- Observed live votes (`/bor/producer-votes`): nearly all validators vote `[91,92,93,94]` — the
  same set as the hardcoded fallback. Cannot distinguish genuine votes vs fallback from this
  endpoint alone (votes map is keyed by voter id). Present as "elected candidate pool currently
  consists of 4 validators; the on-chain votes recorded match the client's built-in fallback list".
- ⚠ What a Bor producer CAN do: order/censor txs within its span (6400 blocks).
  What it CANNOT do alone: finalize history (Heimdall checkpoints + milestones sign state with
  2/3+ voting power), change protocol rules, or mint/steal funds.

### Heimdall hardforks (client-compiled heights, `helper/config.go`)
Mainnet (Heimdall heights): rio 24,404,501 (v2 initialHeight), producerDowntime 34,966,593,
phuket 44,070,000, zurich 47,880,000, ithaca 50,185,000, kyoto 51,533,000, lugano 54,627,000,
karwar 57,006,000. Activation = validators run new client binaries (same model as Avalanche).
Heimdall params (bor params, chain params) are gated by an x/gov authority
(`authtypes.NewModuleAddress(govtypes.ModuleName)` — Cosmos gov module account; `MsgUpdateParams`
checks `srv.authority == msg.Authority`).

### L1 contracts & upgrade authority (on-chain verified on Ethereum mainnet)
From `/chainmanager/params` (live Heimdall state):
| contract | address | type | authority |
|---|---|---|---|
| staking_manager | `0x5e3ef299fddf15eaa0432e6e66473ace8c13d908` | StakeManagerProxy (UpgradableProxy) | proxy owner = Timelock `0xcaf0aa768a3ae1297df20072419db8bb8b5c8cef` |
| root_chain | `0x86e4dc95c7fbdbf52e33d563bbdb00823894c287` | RootChainProxy (UpgradableProxy) | proxy owner = same Timelock |
| staking_info | `0xa59c847bd5ac0172ff4fe912c5d29e5a71a7512b` | StakingInfo (Ownable) | owner = Safe |
| state_sender | `0x28e4f3a7f651294b9564800b2d01f35189a5bfbe` | StateSender (Ownable) | owner = Safe |
| slash_manager | `0x01f645dcd6c796f6bc6c982159b32faaaebdc96a` | Ownable | owner = Safe |
| pol_token | `0x7d1afa7b718fb893db30a3abc0cfc608aacfebb0` | ERC20 (MATIC/POL) | — |

- Proxy pattern: `UpgradableProxy` with
  `IMPLEMENTATION_SLOT = keccak256("matic.network.proxy.implementation")`,
  `OWNER_SLOT = keccak256("matic.network.proxy.owner")` (NOT EIP-1967 / NOT zeppelinos —
  verified against USDC zeppelinos slot sanity check; Routescan verified source `StakeManagerProxy.sol`).
  staking_manager impl (2026-11-12) = `0x1d9ee26f794676acf56bac9a479f766403d0f5cc`.
- **Gnosis Safe `0xfa7d2a996ac6350f4b56c043112da0366a59b74c` = 5-of-9** (getThreshold()=5,
  getOwners()=9 EOAs — addresses in collector output). Directly owns StakingInfo/StateSender/
  SlashManager; also holds Timelock PROPOSER_ROLE + EXECUTOR_ROLE.
- **TimelockController `0xcaf0aa768a3ae1297df20072419db8bb8b5c8cef`** (OZ v3, bytecode strings
  verified; deployed 2022-02 block ~13,106,903 by `0x427ceb53c3532835ccfdbbe4c533286e15d3576e`):
  - `getMinDelay() = 0` (no effective delay as of 2026-11-12!)
  - PROPOSER_ROLE → Safe; EXECUTOR_ROLE → Safe; TIMELOCK_ADMIN_ROLE → deployer EOA + timelock
    itself (RoleGranted events). No CANCELLER_ROLE grants observed.
- Interpretation (must state carefully):
  - 5-of-9 Safe + 0-delay timelock ⇒ **5 of 9 signers can upgrade StakeManager/RootChain logic
    with no waiting period** (schedule+execute in one flow). This is contract-upgrade authority
    over the staking/checkpoint contracts — it can in principle rewrite staking/withdrawal logic
    or checkpoint verification, and thus is a major control point over the bridge + staking.
  - It is NOT a key over user wallets or arbitrary balances on L2; Heimdall consensus itself needs
    2/3+ of validator voting power; Bor blocks come from the elected producer. State what it CAN
    and CANNOT do.
- Checkpoints to L1 are submitted against validator signatures (2/3+ power), not by the multisig
  (see `heimdall-v2/x/checkpoint` + RootChain `submitCheckpoint` verification) — cite code.

## 3. Cross-cutting notes
- Polygon validator names: `https://staking-api.polygon.technology/api/v3/validators/{id}` —
  operator-declared (`name` e.g. "Anonymous 91" for unnamed). Displayed as "operator-declared
  name"; never used to merge entities. Entity-level concentration = not reliably identifiable →
  report "Unknown" except names as declared.
- Avalanche entities: nodeIDs + reward-owner addresses only; no reliable entity mapping → "Unknown".
- Nakamoto methodology: report "min validators to reach ≥33% / ≥50% of voting power" as **weight
  concentration statistics** with explicit formula and caveats per network. For Heimdall (CometBFT):
  >1/3 can halt finality, >2/3 controls consensus — documented. For Snowman: probabilistic
  metastable consensus; do NOT equate thresholds to identical attack capabilities.
- Heimdall voting_power ↔ stake: verified `voting_power ≈ totalStake(wei)/10^15` via staking-api
  (validator 91: 83,489,003 ↔ 83,489.003536 POL).
