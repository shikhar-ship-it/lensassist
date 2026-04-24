"""Cross-conversation memory for each customer.

Two backends:
- "json"     — local file at data/memory/{customer_id}.json (default, demo-safe)
- "dynamodb" — AWS DynamoDB table `lensassist-memory` (production path)

Select via the MEMORY_BACKEND env var. DynamoDB auto-falls-back to JSON if
the table is missing or credentials are expired, so the demo never breaks.
"""
from __future__ import annotations
import json
import os
from datetime import datetime
from pathlib import Path
from typing import Any

MEMORY_DIR = Path(__file__).resolve().parent.parent / "data" / "memory"
MEMORY_DIR.mkdir(parents=True, exist_ok=True)

BACKEND = os.environ.get("MEMORY_BACKEND", "json").lower()
DDB_TABLE = os.environ.get("MEMORY_DDB_TABLE", "lensassist-memory")
DDB_REGION = os.environ.get("AWS_REGION", "us-east-1")

_ddb_table = None
_ddb_failed = False  # remember a single failure so we don't hammer AWS


def _get_ddb_table():
    global _ddb_table, _ddb_failed
    if BACKEND != "dynamodb" or _ddb_failed:
        return None
    if _ddb_table is not None:
        return _ddb_table
    try:
        import boto3  # local import so JSON mode never touches boto3

        _ddb_table = boto3.resource("dynamodb", region_name=DDB_REGION).Table(
            DDB_TABLE
        )
        # warm-up call so we fail fast if table is missing / creds bad
        _ddb_table.load()
        return _ddb_table
    except Exception:
        _ddb_failed = True
        return None


# ──────────────────────────────────────────────────────────────────────────
# JSON file backend
# ──────────────────────────────────────────────────────────────────────────
def _path(customer_id: str) -> Path:
    return MEMORY_DIR / f"{customer_id}.json"


def _json_load(customer_id: str) -> dict[str, Any]:
    p = _path(customer_id)
    if not p.exists():
        return {"customer_id": customer_id, "turns": [], "facts": []}
    return json.loads(p.read_text())


def _json_save(customer_id: str, state: dict[str, Any]) -> None:
    _path(customer_id).write_text(json.dumps(state, indent=2))


def _json_reset(customer_id: str) -> None:
    p = _path(customer_id)
    if p.exists():
        p.unlink()


# ──────────────────────────────────────────────────────────────────────────
# DynamoDB backend
# ──────────────────────────────────────────────────────────────────────────
def _ddb_load(customer_id: str) -> dict[str, Any]:
    tbl = _get_ddb_table()
    if tbl is None:
        return _json_load(customer_id)
    try:
        resp = tbl.get_item(Key={"customer_id": customer_id})
        if "Item" not in resp:
            return {"customer_id": customer_id, "turns": [], "facts": []}
        return resp["Item"]
    except Exception:
        return _json_load(customer_id)


def _ddb_save(customer_id: str, state: dict[str, Any]) -> None:
    tbl = _get_ddb_table()
    if tbl is None:
        _json_save(customer_id, state)
        return
    try:
        tbl.put_item(Item=state)
    except Exception:
        _json_save(customer_id, state)


def _ddb_reset(customer_id: str) -> None:
    tbl = _get_ddb_table()
    if tbl is None:
        _json_reset(customer_id)
        return
    try:
        tbl.delete_item(Key={"customer_id": customer_id})
    except Exception:
        _json_reset(customer_id)


# ──────────────────────────────────────────────────────────────────────────
# Public API (unchanged — swap backend via MEMORY_BACKEND env var)
# ──────────────────────────────────────────────────────────────────────────
def load(customer_id: str) -> dict[str, Any]:
    return _ddb_load(customer_id) if BACKEND == "dynamodb" else _json_load(customer_id)


def save(customer_id: str, state: dict[str, Any]) -> None:
    if BACKEND == "dynamodb":
        _ddb_save(customer_id, state)
    else:
        _json_save(customer_id, state)


def append_turn(customer_id: str, role: str, text: str) -> None:
    state = load(customer_id)
    state.setdefault("turns", []).append(
        {"role": role, "text": text, "at": datetime.utcnow().isoformat()}
    )
    state["turns"] = state["turns"][-40:]
    save(customer_id, state)


def remember_fact(customer_id: str, fact: str) -> None:
    state = load(customer_id)
    facts = state.setdefault("facts", [])
    if fact not in facts:
        facts.append(fact)
        save(customer_id, state)


def reset(customer_id: str) -> None:
    if BACKEND == "dynamodb":
        _ddb_reset(customer_id)
    else:
        _json_reset(customer_id)


def backend_info() -> dict[str, Any]:
    """Report which backend is actually in use (useful for UI indicator)."""
    if BACKEND == "dynamodb":
        active = _get_ddb_table() is not None
        return {
            "configured": "dynamodb",
            "active": "dynamodb" if active else "json-fallback",
            "table": DDB_TABLE if active else None,
            "region": DDB_REGION if active else None,
        }
    return {"configured": "json", "active": "json"}


def summary_block(customer_id: str) -> str:
    state = load(customer_id)
    parts = []
    facts = state.get("facts", [])
    if facts:
        parts.append("Known facts about this customer from prior conversations:")
        for f in facts:
            parts.append(f"- {f}")
    recent = state.get("turns", [])[-10:]
    if recent:
        parts.append("\nRecent conversation history:")
        for t in recent:
            parts.append(f"[{t['role']}] {t['text']}")
    return "\n".join(parts) if parts else "No prior interaction history."
