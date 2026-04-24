"""Lenskart Post-Sales Concierge agent.

Uses Bedrock Claude with tool-use so the model can:
- look up the customer's open Salesforce cases
- retrieve the most relevant policies
- update a case status (auto-resolve or escalate)

The agent maintains cross-conversation memory per customer.
"""
from __future__ import annotations
import json
import os
from pathlib import Path
from typing import Any

import boto3
from dotenv import load_dotenv

from . import knowledge, memory, salesforce_mock

load_dotenv()

MODEL_ID = os.environ.get(
    "BEDROCK_MODEL_ID", "us.anthropic.claude-sonnet-4-5-20250929-v1:0"
)
REGION = os.environ.get("AWS_REGION", "us-east-1")

CUSTOMERS_FILE = Path(__file__).resolve().parent.parent / "data" / "customers.json"


def _bedrock_client():
    return boto3.client("bedrock-runtime", region_name=REGION)


def load_customer(customer_id: str) -> dict[str, Any]:
    return json.loads(CUSTOMERS_FILE.read_text())[customer_id]


SYSTEM_PROMPT = """You are "LensAssist", Lenskart's AI post-sales concierge.

You handle ALL post-sales journeys for a customer: order tracking, returns, \
warranty claims, lens issues, wrong power, membership queries, and refunds. \
You have memory of every past conversation with this customer and full \
access to their Salesforce cases.

Your mission on every turn:
1. Read the customer profile and memory FIRST before responding.
2. If the customer asks about an issue that is already an open case, reference \
   it by case ID instead of creating a parallel thread.
3. Use the policy context to give accurate, specific answers — never invent \
   policy terms. If a policy does not cover the case, say so and offer to \
   escalate.
4. Decide when you can AUTO-RESOLVE (clearly covered by policy, customer is \
   satisfied) vs ESCALATE (requires human agent, legal, or ops).
5. Use the available tools to look up cases and update case status. After you \
   auto-resolve or escalate, call the update_case_status tool — don't just \
   say you did it.
6. Be warm, brief, and concrete. Prices in rupees (₹) unless customer is \
   international (use their local currency if known).
7. If a claim requires evidence (photos, Rx copy) ask for it specifically.
8. For Gold members, surface their priority benefits proactively.

LANGUAGE POLICY (critical):
- Detect the language of the customer's latest message and REPLY IN THE SAME LANGUAGE.
- If the message is in Devanagari (हिन्दी): reply in natural, conversational \
  Hindi using Devanagari script. Use polite forms — "आप", "जी", "कृपया". \
  Keep product names and case IDs in English (e.g. "Vincent Chase", "SF-7001").
- If the message is Hinglish (Hindi words typed in Roman / English letters, \
  e.g. "mera order kab aayega"): reply in the same Hinglish style using \
  Roman script. Natural, not formal.
- Otherwise (English): reply in warm Indian English.
- If the customer switches language mid-conversation, switch with them.
- Do NOT translate policy terms like "warranty", "Gold Member", or "Rx" — \
  Indian customers use these in English even inside Hindi sentences.

GENDER (Hindi verbs agree with speaker gender — critical for natural voice):
- You are LensAssist, speaking with a FEMALE voice.
- In Hindi: ALWAYS use feminine self-reference verb forms.
  ✓ "मैं आपकी मदद कर रही हूँ" (correct: female speaker)
  ✗ "मैं आपकी मदद कर रहा हूँ" (wrong: male speaker)
  ✓ "मैं देख रही हूँ", "मैं समझ सकती हूँ", "मैंने की है", "मैंने भेजी है"
  ✗ "मैं देख रहा हूँ", "मैं समझ सकता हूँ", "मैंने किया है", "मैंने भेजा है"
- In Hinglish (Roman): same rule — use feminine forms.
  ✓ "main kar rahi hoon", "main dekh rahi hoon", "maine check kiya hai" → "main ne check kiya hai" is fine (past-tense kiya stays neutral with object agreement)
  ✗ "main kar raha hoon", "main dekh raha hoon"
- This applies to YOUR self-reference only. Use whatever form fits the customer's gender when referring to them.

Output tone: professional, empathetic, no fluff. 2–4 sentences per turn \
unless a detailed step-by-step is needed.

FORMATTING (important — your replies are spoken aloud by a voice assistant):
- Do NOT use emojis.
- Avoid bold (**word**), headers (#), bullet lists, or other markdown. If you \
  must enumerate steps, say "First… Second… Third…" in prose.
- Prefer short, rhythmic sentences (under ~20 words) so speech synthesis \
  sounds natural. No long compound sentences.
"""


TOOLS = [
    {
        "toolSpec": {
            "name": "get_customer_cases",
            "description": "Return all Salesforce cases for the current customer (open and resolved).",
            "inputSchema": {
                "json": {
                    "type": "object",
                    "properties": {},
                    "required": [],
                }
            },
        }
    },
    {
        "toolSpec": {
            "name": "update_case_status",
            "description": (
                "Update the status of a Salesforce case. Use 'Resolved' when the issue "
                "is fully addressed, 'Escalated' when it needs human agent or ops team, "
                "'Awaiting Customer' when waiting on evidence or confirmation from the customer."
            ),
            "inputSchema": {
                "json": {
                    "type": "object",
                    "properties": {
                        "case_id": {
                            "type": "string",
                            "description": "Salesforce case ID, e.g. SF-7001",
                        },
                        "status": {
                            "type": "string",
                            "enum": ["Resolved", "Escalated", "Awaiting Customer"],
                        },
                        "resolution_note": {
                            "type": "string",
                            "description": "Short note explaining what was done or why it was escalated.",
                        },
                    },
                    "required": ["case_id", "status", "resolution_note"],
                }
            },
        }
    },
    {
        "toolSpec": {
            "name": "remember_fact",
            "description": (
                "Store a durable fact about this customer so you remember it in future "
                "conversations (e.g., 'prefers Hindi', 'allergic to nickel frames', 'works night shift')."
            ),
            "inputSchema": {
                "json": {
                    "type": "object",
                    "properties": {
                        "fact": {"type": "string"},
                    },
                    "required": ["fact"],
                }
            },
        }
    },
]


def _handle_tool_call(
    tool_name: str, tool_input: dict[str, Any], customer_id: str
) -> str:
    if tool_name == "get_customer_cases":
        cases = salesforce_mock.list_cases_for_customer(customer_id)
        if not cases:
            return "No cases found for this customer."
        return "\n\n".join(salesforce_mock.case_summary(c) for c in cases)

    if tool_name == "update_case_status":
        case_id = tool_input["case_id"]
        status = tool_input["status"]
        note = tool_input["resolution_note"]
        case = salesforce_mock.get_case(case_id)
        if not case:
            return f"ERROR: case {case_id} not found."
        if case["customer_id"] != customer_id:
            return f"ERROR: case {case_id} belongs to a different customer."
        salesforce_mock.update_status(case_id, status, note)
        return f"Case {case_id} updated to {status}. Note: {note}"

    if tool_name == "remember_fact":
        fact = tool_input["fact"]
        memory.remember_fact(customer_id, fact)
        return f"Stored: {fact}"

    return f"Unknown tool: {tool_name}"


def _build_prompt_context(customer_id: str, user_message: str) -> tuple[list, list]:
    customer = load_customer(customer_id)
    history = memory.summary_block(customer_id)
    policy_ctx = knowledge.context_block(user_message)
    system_blocks = [
        {"text": SYSTEM_PROMPT},
        {
            "text": (
                f"CUSTOMER PROFILE:\n{json.dumps(customer, indent=2)}\n\n"
                f"MEMORY FROM PAST CONVERSATIONS:\n{history}\n\n"
                f"RELEVANT POLICIES (retrieved for this query):\n{policy_ctx}"
            )
        },
    ]
    messages: list[dict[str, Any]] = [
        {"role": "user", "content": [{"text": user_message}]}
    ]
    return system_blocks, messages


def respond_stream(customer_id: str, user_message: str):
    """Generator that streams events as Claude produces them.

    Yields dicts of shape:
      {"type": "text", "chunk": str}               — token stream
      {"type": "tool_start", "tool": str}          — before a tool runs
      {"type": "tool_result", "tool": str,
        "input": dict, "output": str}              — after a tool runs
      {"type": "done", "reply": str,
        "trace": [...]}                            — final turn complete
      {"type": "error", "message": str}
    """
    system_blocks, messages = _build_prompt_context(customer_id, user_message)
    client = _bedrock_client()
    trace: list[dict[str, Any]] = []
    full_reply_parts: list[str] = []

    for _ in range(6):
        try:
            stream_resp = client.converse_stream(
                modelId=MODEL_ID,
                system=system_blocks,
                messages=messages,
                toolConfig={"tools": TOOLS},
                inferenceConfig={"maxTokens": 1024, "temperature": 0.3},
            )
        except Exception as e:
            yield {"type": "error", "message": str(e)}
            return

        # Reassemble the assistant message while streaming
        assistant_content: list[dict[str, Any]] = []
        current_text = ""
        current_tool: dict[str, Any] | None = None
        current_tool_input = ""
        stop_reason: str | None = None
        current_type: str | None = None  # "text" or "toolUse"

        for event in stream_resp["stream"]:
            if "contentBlockStart" in event:
                start = event["contentBlockStart"]["start"]
                if "toolUse" in start:
                    current_type = "toolUse"
                    current_tool = {
                        "toolUseId": start["toolUse"]["toolUseId"],
                        "name": start["toolUse"]["name"],
                    }
                    current_tool_input = ""
                    yield {"type": "tool_start", "tool": current_tool["name"]}
                else:
                    current_type = "text"
                    current_text = ""
            elif "contentBlockDelta" in event:
                delta = event["contentBlockDelta"]["delta"]
                if "text" in delta:
                    chunk = delta["text"]
                    current_text += chunk
                    full_reply_parts.append(chunk)
                    yield {"type": "text", "chunk": chunk}
                elif "toolUse" in delta:
                    current_tool_input += delta["toolUse"].get("input", "")
            elif "contentBlockStop" in event:
                if current_type == "toolUse" and current_tool is not None:
                    try:
                        input_data = (
                            json.loads(current_tool_input) if current_tool_input else {}
                        )
                    except json.JSONDecodeError:
                        input_data = {}
                    assistant_content.append(
                        {
                            "toolUse": {
                                "toolUseId": current_tool["toolUseId"],
                                "name": current_tool["name"],
                                "input": input_data,
                            }
                        }
                    )
                    current_tool = None
                    current_tool_input = ""
                elif current_type == "text" and current_text:
                    assistant_content.append({"text": current_text})
                current_type = None
            elif "messageStop" in event:
                stop_reason = event["messageStop"].get("stopReason")

        messages.append({"role": "assistant", "content": assistant_content})

        if stop_reason != "tool_use":
            reply_text = "".join(full_reply_parts).strip()
            memory.append_turn(customer_id, "customer", user_message)
            memory.append_turn(customer_id, "agent", reply_text)
            yield {"type": "done", "reply": reply_text, "trace": trace}
            return

        # Run tools, stream results back
        tool_results = []
        for block in assistant_content:
            if "toolUse" not in block:
                continue
            tu = block["toolUse"]
            result = _handle_tool_call(tu["name"], tu["input"], customer_id)
            trace.append(
                {"tool": tu["name"], "input": tu["input"], "output": result}
            )
            yield {
                "type": "tool_result",
                "tool": tu["name"],
                "input": tu["input"],
                "output": result,
            }
            tool_results.append(
                {
                    "toolResult": {
                        "toolUseId": tu["toolUseId"],
                        "content": [{"text": result}],
                    }
                }
            )
        messages.append({"role": "user", "content": tool_results})

    memory.append_turn(customer_id, "customer", user_message)
    memory.append_turn(customer_id, "agent", "(tool-loop limit)")
    yield {
        "type": "done",
        "reply": "Sorry, I got stuck — let me connect you to a human agent.",
        "trace": trace,
    }


def respond(customer_id: str, user_message: str) -> dict[str, Any]:
    """Run one turn. Returns dict with 'reply', 'trace' (tool calls)."""
    system_blocks, messages = _build_prompt_context(customer_id, user_message)
    client = _bedrock_client()
    trace: list[dict[str, Any]] = []

    for _ in range(6):
        resp = client.converse(
            modelId=MODEL_ID,
            system=system_blocks,
            messages=messages,
            toolConfig={"tools": TOOLS},
            inferenceConfig={"maxTokens": 1024, "temperature": 0.3},
        )
        output = resp["output"]["message"]
        messages.append(output)

        stop = resp.get("stopReason")
        if stop != "tool_use":
            reply_text = "".join(
                b.get("text", "") for b in output["content"] if "text" in b
            ).strip()
            memory.append_turn(customer_id, "customer", user_message)
            memory.append_turn(customer_id, "agent", reply_text)
            return {"reply": reply_text, "trace": trace}

        tool_results = []
        for block in output["content"]:
            if "toolUse" not in block:
                continue
            tu = block["toolUse"]
            result = _handle_tool_call(tu["name"], tu["input"], customer_id)
            trace.append(
                {"tool": tu["name"], "input": tu["input"], "output": result}
            )
            tool_results.append(
                {
                    "toolResult": {
                        "toolUseId": tu["toolUseId"],
                        "content": [{"text": result}],
                    }
                }
            )
        messages.append({"role": "user", "content": tool_results})

    memory.append_turn(customer_id, "customer", user_message)
    memory.append_turn(
        customer_id, "agent", "(agent reached tool-loop limit without final reply)"
    )
    return {"reply": "Sorry, I got stuck — let me connect you to a human agent.", "trace": trace}
