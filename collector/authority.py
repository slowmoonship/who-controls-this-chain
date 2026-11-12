"""Protocol-upgrade authority collector.

Polygon PoS L1 contracts (Ethereum mainnet) are re-read on-chain every run:
proxy implementation/owner slots, the Gnosis Safe threshold/owners, and the
TimelockController parameters. Verified 2026-11-12 — see research/NOTES.md.

Avalanche Primary Network has no on-chain admin key for consensus rules;
upgrades activate via client software timestamps (avalanchego ``upgrade`` pkg).
That part is static evidence (links in sources.json), not a live read.
"""

from __future__ import annotations

from typing import Any

from .http import fetch_json

DEFAULT_ETH_RPC = "https://ethereum-rpc.publicnode.com"

# keccak256("matic.network.proxy.implementation") / keccak256("matic.network.proxy.owner")
IMPL_SLOT = "0xbaab7dbf64751104133af04abc7d9979f0fda3b059a322a8333f533d3f32bf7f"
OWNER_SLOT = "0x44f6e2e8884cba1236b7f22f351fa5d88b17292b7e0225ca47e5ecdf6055cdd6"

SAFE = "0xfa7d2a996ac6350f4b56c043112da0366a59b74c"
TIMELOCK = "0xcaf0aa768a3ae1297df20072419db8bb8b5c8cef"
TIMELOCK_DEPLOYER = "0x427ceb53c3532835ccfdbbe4c533286e15d3576e"

# Role ids (keccak256 of the role name).
ROLE_PROPOSER = "0xb09aa5aeb3702cfd50b6b62bc4532604938f21248a27a1d5ca736082b6819cc1"
ROLE_EXECUTOR = "0xd8aa0f3194971a2a116679f7c2090f6939c8d4e01a2a8d7e41d55e5351469e63"
ROLE_CANCELLER = "0xfd643c72710c63c0180259aba6b2d05451e3591a24e58b62239378085726f783"
ROLE_TIMELOCK_ADMIN = "0x5f58e3a2316349923ce3780f8d587db2d72378aed66a8261c916544fa6846ca5"

SEL_GET_THRESHOLD = "0xe75235b8"  # getThreshold()
SEL_GET_OWNERS = "0xa0e67e2b"  # getOwners()
SEL_MIN_DELAY = "0xf27a0c92"  # getMinDelay()
SEL_HAS_ROLE = "0x91d14854"  # hasRole(bytes32,address)

# Contracts tracked from Heimdall chainmanager params (latest verified set).
L1_CONTRACTS = {
    "staking_manager": "0x5e3ef299fddf15eaa0432e6e66473ace8c13d908",
    "root_chain": "0x86e4dc95c7fbdbf52e33d563bbdb00823894c287",
    "staking_info": "0xa59c847bd5ac0172ff4fe912c5d29e5a71a7512b",
    "state_sender": "0x28e4f3a7f651294b9564800b2d01f35189a5bfbe",
    "slash_manager": "0x01f645dcd6c796f6bc6c982159b32faaaebdc96a",
}


def _eth(rpc: str, method: str, params: list[Any]) -> Any:
    body = fetch_json(
        rpc,
        method="POST",
        payload={"jsonrpc": "2.0", "id": 1, "method": method, "params": params},
    )
    if body.get("error"):
        raise RuntimeError(f"{method}: {body['error']}")
    return body.get("result")


def _call(rpc: str, to: str, data: str) -> str | None:
    result = _eth(rpc, "eth_call", [{"to": to, "data": data}, "latest"])
    return result if result and result != "0x" else None


def _word_to_addr(word: str | None) -> str | None:
    if not word or len(word) < 42:
        return None
    addr = "0x" + word[-40:]
    return None if int(addr, 16) == 0 else addr


def _has_role(rpc: str, role: str, account: str) -> bool:
    data = SEL_HAS_ROLE + role[2:].rjust(64, "0") + account[2:].lower().rjust(64, "0")
    out = _call(rpc, TIMELOCK, data)
    return bool(out and int(out, 16) == 1)


def collect_authority(eth_rpc: str = DEFAULT_ETH_RPC) -> dict[str, Any]:
    contracts: dict[str, Any] = {}
    for name, addr in L1_CONTRACTS.items():
        impl = _word_to_addr(_eth(rpc=eth_rpc, method="eth_getStorageAt", params=[addr, IMPL_SLOT, "latest"]))
        owner = _word_to_addr(_eth(rpc=eth_rpc, method="eth_getStorageAt", params=[addr, OWNER_SLOT, "latest"]))
        # Ownable-style contracts keep owner() in slot 0 / expose owner().
        if owner is None:
            owner = _word_to_addr(_call(eth_rpc, addr, "0x8da5cb5b"))  # owner()
        contracts[name] = {
            "address": addr,
            "implementation": impl,
            "owner": owner,
        }

    # Gnosis Safe (owner of three contracts + timelock proposer/executor).
    threshold = _call(eth_rpc, SAFE, SEL_GET_THRESHOLD)
    owners_raw = _call(eth_rpc, SAFE, SEL_GET_OWNERS)
    safe_owners: list[str] = []
    if owners_raw and len(owners_raw) > 2 + 64 * 2:
        words = [owners_raw[2 + 64 * i : 2 + 64 * (i + 1)] for i in range((len(owners_raw) - 2) // 64)]
        n = int(words[1], 16)
        safe_owners = ["0x" + words[2 + i][-40:] for i in range(min(n, len(words) - 2))]

    min_delay = _call(eth_rpc, TIMELOCK, SEL_MIN_DELAY)

    return {
        "polygon_l1": {
            "contracts": contracts,
            "safe": {
                "address": SAFE,
                "threshold": int(threshold, 16) if threshold else None,
                "owners_count": len(safe_owners),
                "owners": safe_owners,
                "note": "Gnosis Safe; owners are addresses only — real-world identities not verified.",
            },
            "timelock": {
                "address": TIMELOCK,
                "type": "OZ v3 TimelockController (verified via bytecode + events)",
                "min_delay_seconds": int(min_delay, 16) if min_delay else None,
                "deployer": TIMELOCK_DEPLOYER,
                "roles": {
                    "PROPOSER_ROLE": {"grantee": SAFE},
                    "EXECUTOR_ROLE": {"grantee": SAFE},
                    "TIMELOCK_ADMIN_ROLE": {
                        "grantees_at_deployment": [TIMELOCK_DEPLOYER, TIMELOCK],
                        "source": "RoleGranted events (2022-02 deployment); see live_role_checks for current holders",
                    },
                    "CANCELLER_ROLE": {"grantees": [], "source": "no RoleGranted events observed"},
                },
                "live_role_checks": {
                    "safe_is_proposer": _has_role(eth_rpc, ROLE_PROPOSER, SAFE),
                    "safe_is_executor": _has_role(eth_rpc, ROLE_EXECUTOR, SAFE),
                    "safe_is_canceller": _has_role(eth_rpc, ROLE_CANCELLER, SAFE),
                    "deployer_is_timelock_admin": _has_role(eth_rpc, ROLE_TIMELOCK_ADMIN, TIMELOCK_DEPLOYER),
                },
            },
            "sources": [
                {
                    "id": "eth-rpc-storage",
                    "label": "Ethereum JSON-RPC eth_getStorageAt / eth_call (matic.network proxy slots)",
                    "url": eth_rpc,
                    "kind": "rpc",
                },
            ],
        },
        "polygon_heimdall": {
            "params_authority": (
                "Heimdall x/gov module account — MsgUpdateParams checks the gov "
                "authority address (heimdall-v2 app wiring); validator-weighted voting."
            ),
            "hardforks": (
                "Named hardfork heights are compiled into heimdalld binaries "
                "(helper/config.go); activation requires validator software adoption."
            ),
        },
        "avalanche": {
            "mechanism": (
                "No on-chain admin key for Primary Network consensus rules. Named "
                "upgrades (Apricot..Helicon) activate at wall-clock timestamps compiled "
                "into avalanchego (upgrade/upgrade.go); validators must adopt new client "
                "software. Influence concentrates in client development + release "
                "coordination rather than a multisig."
            ),
            "latest_named_upgrades_mainnet": {
                "durango": "2024-03-06T16:00:00Z",
                "etna": "2024-12-16T17:00:00Z",
                "fortuna": "2025-04-08T15:00:00Z",
                "granite": "2025-11-19T16:00:00Z",
                "helicon": "2026-09-22T15:00:00Z",
                "igloo": "unscheduled",
            },
            "sources": [
                {
                    "id": "avalanchego-upgrade",
                    "label": "avalanchego upgrade/upgrade.go (mainnet schedule)",
                    "url": "https://github.com/ava-labs/avalanchego/blob/master/upgrade/upgrade.go",
                    "kind": "code",
                },
            ],
        },
    }
