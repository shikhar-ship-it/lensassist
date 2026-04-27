"""Unified data layer for LensAssist.

All stateful data lives in DynamoDB:
- lensassist-customers   (PK = customer_id)
- lensassist-cases       (PK = case_id)
- lensassist-policies    (PK = name, attribute = body)
- lensassist-memory      (PK = customer_id) — handled in agent/memory.py

Tables are auto-created if missing. On first read of an empty table, seed
data from data/customers.json, data/cases.json, data/policies/*.md is
auto-loaded so the demo always boots with realistic content.

Falls back to file I/O if DynamoDB is unreachable, so local dev without AWS
creds still works.
"""
from __future__ import annotations

import json
import os
import sys
from pathlib import Path
from typing import Any

import boto3

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
REGION = os.environ.get("AWS_REGION", "us-east-1")

CUSTOMERS_TABLE = os.environ.get("CUSTOMERS_DDB_TABLE", "lensassist-customers")
CASES_TABLE = os.environ.get("CASES_DDB_TABLE", "lensassist-cases")
POLICIES_TABLE = os.environ.get("POLICIES_DDB_TABLE", "lensassist-policies")

_resource = None
_tables: dict[str, Any] = {}
_seeded: set[str] = set()


def _log(msg: str) -> None:
    print(f"[storage] {msg}", file=sys.stderr, flush=True)


def _ddb_resource():
    global _resource
    if _resource is None:
        _resource = boto3.resource("dynamodb", region_name=REGION)
    return _resource


def _ensure_table(name: str, partition_key: str) -> Any:
    """Return a Table resource, creating the table if missing.

    Returns None if DynamoDB is unreachable (e.g. no creds locally).
    """
    if name in _tables:
        return _tables[name]
    try:
        client = boto3.client("dynamodb", region_name=REGION)
        try:
            client.describe_table(TableName=name)
        except client.exceptions.ResourceNotFoundException:
            _log(f"creating DynamoDB table: {name}")
            client.create_table(
                TableName=name,
                AttributeDefinitions=[
                    {"AttributeName": partition_key, "AttributeType": "S"}
                ],
                KeySchema=[{"AttributeName": partition_key, "KeyType": "HASH"}],
                BillingMode="PAY_PER_REQUEST",
            )
            client.get_waiter("table_exists").wait(
                TableName=name, WaiterConfig={"Delay": 2, "MaxAttempts": 30}
            )
            _log(f"table {name} ACTIVE")
        tbl = _ddb_resource().Table(name)
        _tables[name] = tbl
        return tbl
    except Exception as e:  # noqa: BLE001
        _log(f"DynamoDB unavailable for {name}: {e}; falling back to file I/O")
        _tables[name] = None
        return None


def _scan_all(tbl) -> list[dict[str, Any]]:
    items: list[dict[str, Any]] = []
    last = None
    while True:
        kwargs: dict[str, Any] = {}
        if last:
            kwargs["ExclusiveStartKey"] = last
        resp = tbl.scan(**kwargs)
        items.extend(resp.get("Items", []))
        last = resp.get("LastEvaluatedKey")
        if not last:
            break
    return items


# ──────────────────────────────────────────────────────────────────────────
# CUSTOMERS
# ──────────────────────────────────────────────────────────────────────────
_CUSTOMERS_FILE = DATA_DIR / "customers.json"


def _file_customers_load() -> dict[str, Any]:
    if not _CUSTOMERS_FILE.exists():
        return {}
    return json.loads(_CUSTOMERS_FILE.read_text())


def _file_customers_save(data: dict[str, Any]) -> None:
    _CUSTOMERS_FILE.write_text(json.dumps(data, indent=2))


def _seed_customers(tbl) -> None:
    if "customers" in _seeded:
        return
    seed = _file_customers_load()
    if not seed:
        return
    _log(f"seeding {len(seed)} customers from {_CUSTOMERS_FILE.name}")
    with tbl.batch_writer() as batch:
        for cust in seed.values():
            batch.put_item(Item=cust)
    _seeded.add("customers")


def customers_load_all() -> dict[str, Any]:
    tbl = _ensure_table(CUSTOMERS_TABLE, "customer_id")
    if tbl is None:
        return _file_customers_load()
    # Seed if empty
    if not tbl.scan(Limit=1).get("Items"):
        _seed_customers(tbl)
    items = _scan_all(tbl)
    return {item["customer_id"]: item for item in items}


def customer_get(customer_id: str) -> dict[str, Any] | None:
    tbl = _ensure_table(CUSTOMERS_TABLE, "customer_id")
    if tbl is None:
        return _file_customers_load().get(customer_id)
    return tbl.get_item(Key={"customer_id": customer_id}).get("Item")


def customer_save(data: dict[str, Any]) -> dict[str, Any]:
    tbl = _ensure_table(CUSTOMERS_TABLE, "customer_id")
    if tbl is None:
        all_c = _file_customers_load()
        all_c[data["customer_id"]] = data
        _file_customers_save(all_c)
        return data
    tbl.put_item(Item=data)
    return data


def customer_delete(customer_id: str) -> bool:
    tbl = _ensure_table(CUSTOMERS_TABLE, "customer_id")
    if tbl is None:
        all_c = _file_customers_load()
        if customer_id not in all_c:
            return False
        del all_c[customer_id]
        _file_customers_save(all_c)
        return True
    tbl.delete_item(Key={"customer_id": customer_id})
    return True


# ──────────────────────────────────────────────────────────────────────────
# CASES
# ──────────────────────────────────────────────────────────────────────────
_CASES_FILE = DATA_DIR / "cases.json"


def _file_cases_load() -> dict[str, Any]:
    if not _CASES_FILE.exists():
        return {}
    return json.loads(_CASES_FILE.read_text())


def _file_cases_save(data: dict[str, Any]) -> None:
    _CASES_FILE.write_text(json.dumps(data, indent=2))


def _seed_cases(tbl) -> None:
    if "cases" in _seeded:
        return
    seed = _file_cases_load()
    if not seed:
        return
    _log(f"seeding {len(seed)} cases from {_CASES_FILE.name}")
    with tbl.batch_writer() as batch:
        for case in seed.values():
            batch.put_item(Item=case)
    _seeded.add("cases")


def cases_load_all() -> dict[str, Any]:
    tbl = _ensure_table(CASES_TABLE, "case_id")
    if tbl is None:
        return _file_cases_load()
    if not tbl.scan(Limit=1).get("Items"):
        _seed_cases(tbl)
    items = _scan_all(tbl)
    return {item["case_id"]: item for item in items}


def case_get(case_id: str) -> dict[str, Any] | None:
    tbl = _ensure_table(CASES_TABLE, "case_id")
    if tbl is None:
        return _file_cases_load().get(case_id)
    return tbl.get_item(Key={"case_id": case_id}).get("Item")


def case_save(data: dict[str, Any]) -> dict[str, Any]:
    tbl = _ensure_table(CASES_TABLE, "case_id")
    if tbl is None:
        all_c = _file_cases_load()
        all_c[data["case_id"]] = data
        _file_cases_save(all_c)
        return data
    tbl.put_item(Item=data)
    return data


def case_delete(case_id: str) -> bool:
    tbl = _ensure_table(CASES_TABLE, "case_id")
    if tbl is None:
        all_c = _file_cases_load()
        if case_id not in all_c:
            return False
        del all_c[case_id]
        _file_cases_save(all_c)
        return True
    tbl.delete_item(Key={"case_id": case_id})
    return True


def cases_for_customer(customer_id: str) -> list[dict[str, Any]]:
    return [c for c in cases_load_all().values() if c.get("customer_id") == customer_id]


# ──────────────────────────────────────────────────────────────────────────
# POLICIES
# ──────────────────────────────────────────────────────────────────────────
_POLICIES_DIR = DATA_DIR / "policies"


def _file_policies_load() -> dict[str, str]:
    if not _POLICIES_DIR.exists():
        return {}
    return {p.stem: p.read_text() for p in _POLICIES_DIR.glob("*.md")}


def _seed_policies(tbl) -> None:
    if "policies" in _seeded:
        return
    seed = _file_policies_load()
    if not seed:
        return
    _log(f"seeding {len(seed)} policies from {_POLICIES_DIR.name}/")
    with tbl.batch_writer() as batch:
        for name, body in seed.items():
            batch.put_item(Item={"name": name, "body": body})
    _seeded.add("policies")


def policies_load_all() -> dict[str, str]:
    tbl = _ensure_table(POLICIES_TABLE, "name")
    if tbl is None:
        return _file_policies_load()
    if not tbl.scan(Limit=1).get("Items"):
        _seed_policies(tbl)
    items = _scan_all(tbl)
    return {item["name"]: item["body"] for item in items}


def policy_save(name: str, body: str) -> dict[str, str]:
    safe_name = "".join(c for c in name if c.isalnum() or c in ("_", "-")).strip("_-")
    if not safe_name:
        raise ValueError("Policy name cannot be empty after sanitization")
    tbl = _ensure_table(POLICIES_TABLE, "name")
    if tbl is None:
        # File fallback
        path = _POLICIES_DIR / f"{safe_name}.md"
        path.write_text(body)
        return {"name": safe_name, "body": body, "path": str(path.relative_to(DATA_DIR.parent))}
    tbl.put_item(Item={"name": safe_name, "body": body})
    return {"name": safe_name, "body": body, "path": f"ddb://{POLICIES_TABLE}/{safe_name}"}


def policy_delete(name: str) -> bool:
    tbl = _ensure_table(POLICIES_TABLE, "name")
    if tbl is None:
        path = _POLICIES_DIR / f"{name}.md"
        if not path.exists():
            return False
        path.unlink()
        return True
    tbl.delete_item(Key={"name": name})
    return True


def policy_list() -> list[dict[str, str]]:
    """Return [{name, body, path}] for every policy."""
    items = policies_load_all()
    return [
        {
            "name": name,
            "body": body,
            "path": f"ddb://{POLICIES_TABLE}/{name}",
        }
        for name, body in sorted(items.items())
    ]
