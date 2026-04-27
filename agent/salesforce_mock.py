"""Mock Salesforce: read/write cases via the unified storage layer (DynamoDB)."""
from __future__ import annotations
from datetime import datetime
from pathlib import Path
from typing import Any

from . import storage

# Kept for backwards compatibility (older code paths reference it).
CASES_FILE = Path(__file__).resolve().parent.parent / "data" / "cases.json"


def list_open_cases() -> list[dict[str, Any]]:
    return [c for c in storage.cases_load_all().values() if c.get("status") == "Open"]


def list_cases_for_customer(customer_id: str) -> list[dict[str, Any]]:
    return storage.cases_for_customer(customer_id)


def get_case(case_id: str) -> dict[str, Any] | None:
    return storage.case_get(case_id)


def append_message(case_id: str, role: str, text: str) -> None:
    case = storage.case_get(case_id)
    if not case:
        return
    case.setdefault("messages", []).append(
        {"role": role, "text": text, "at": datetime.utcnow().isoformat()}
    )
    case["last_update"] = datetime.utcnow().isoformat()
    storage.case_save(case)


def update_status(case_id: str, status: str, note: str = "") -> None:
    case = storage.case_get(case_id)
    if not case:
        return
    case["status"] = status
    case["last_update"] = datetime.utcnow().isoformat()
    if note:
        case.setdefault("messages", []).append(
            {"role": "system", "text": note, "at": case["last_update"]}
        )
    storage.case_save(case)


def case_summary(case: dict[str, Any]) -> str:
    lines = [
        f"Case {case['case_id']} | Order {case['order_id']} | {case['status']} | {case['priority']}",
        f"Subject: {case['subject']}",
        f"Product: {case['product']}",
        f"Description: {case['description']}",
        f"Channel: {case['channel']} | Created: {case['created']}",
    ]
    return "\n".join(lines)
