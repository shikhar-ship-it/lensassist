"""Proactive outreach: scan open cases, draft follow-ups for stale ones.

In production this would be an EventBridge-scheduled Lambda. For demo, run it
manually: `python scripts/proactive_outreach.py`
"""
from __future__ import annotations
import json
import os
import sys
from datetime import datetime, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import boto3
from dotenv import load_dotenv

from agent import salesforce_mock

load_dotenv()

MODEL_ID = os.environ.get(
    "BEDROCK_MODEL_ID", "anthropic.claude-sonnet-4-5-20250929-v1:0"
)
REGION = os.environ.get("AWS_REGION", "us-east-1")
STALE_HOURS = 24
CUSTOMERS = json.loads(
    (Path(__file__).resolve().parent.parent / "data" / "customers.json").read_text()
)


def is_stale(case: dict) -> bool:
    last = datetime.fromisoformat(case["last_update"])
    return datetime.utcnow() - last > timedelta(hours=STALE_HOURS)


def draft_followup(case: dict) -> str:
    customer = CUSTOMERS[case["customer_id"]]
    client = boto3.client("bedrock-runtime", region_name=REGION)
    prompt = (
        f"Draft a short, warm WhatsApp follow-up message to {customer['name']} "
        f"about their open Lenskart case. Under 50 words. Mention the case in one line, "
        f"acknowledge the delay, and offer one clear next step.\n\n"
        f"CASE:\n{salesforce_mock.case_summary(case)}\n\n"
        f"CUSTOMER: {customer['name']}, Gold Member: {customer.get('gold_member', False)}\n\n"
        f"Write only the message text. No preamble."
    )
    resp = client.converse(
        modelId=MODEL_ID,
        messages=[{"role": "user", "content": [{"text": prompt}]}],
        inferenceConfig={"maxTokens": 200, "temperature": 0.5},
    )
    return "".join(
        b.get("text", "") for b in resp["output"]["message"]["content"] if "text" in b
    ).strip()


def main() -> None:
    open_cases = salesforce_mock.list_open_cases()
    stale = [c for c in open_cases if is_stale(c)]
    print(f"Found {len(open_cases)} open cases, {len(stale)} stale (>{STALE_HOURS}h).")
    for case in stale:
        print(f"\n--- {case['case_id']} · {case['subject']} ---")
        msg = draft_followup(case)
        print(f"📲 Drafted WhatsApp:\n{msg}")
        salesforce_mock.append_message(case["case_id"], "agent_draft", msg)
    print("\nDone. Drafts appended to each case's message log.")


if __name__ == "__main__":
    main()
