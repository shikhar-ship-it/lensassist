"""Mock Salesforce: read/write cases in a JSON file."""
from __future__ import annotations
import json
from datetime import datetime
from pathlib import Path
from typing import Any

CASES_FILE = Path(__file__).resolve().parent.parent / "data" / "cases.json"


def _load() -> dict[str, Any]:
    return json.loads(CASES_FILE.read_text())


def _save(cases: dict[str, Any]) -> None:
    CASES_FILE.write_text(json.dumps(cases, indent=2))


def list_open_cases() -> list[dict[str, Any]]:
    return [c for c in _load().values() if c["status"] == "Open"]


def list_cases_for_customer(customer_id: str) -> list[dict[str, Any]]:
    return [c for c in _load().values() if c["customer_id"] == customer_id]


def get_case(case_id: str) -> dict[str, Any] | None:
    return _load().get(case_id)


def append_message(case_id: str, role: str, text: str) -> None:
    cases = _load()
    c = cases[case_id]
    c["messages"].append(
        {"role": role, "text": text, "at": datetime.utcnow().isoformat()}
    )
    c["last_update"] = datetime.utcnow().isoformat()
    _save(cases)


def update_status(case_id: str, status: str, note: str = "") -> None:
    cases = _load()
    c = cases[case_id]
    c["status"] = status
    c["last_update"] = datetime.utcnow().isoformat()
    if note:
        c["messages"].append(
            {"role": "system", "text": note, "at": c["last_update"]}
        )
    _save(cases)


def case_summary(case: dict[str, Any]) -> str:
    lines = [
        f"Case {case['case_id']} | Order {case['order_id']} | {case['status']} | {case['priority']}",
        f"Subject: {case['subject']}",
        f"Product: {case['product']}",
        f"Description: {case['description']}",
        f"Channel: {case['channel']} | Created: {case['created']}",
    ]
    return "\n".join(lines)
