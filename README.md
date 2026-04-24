# LensAssist — Lenskart Post-Sales AI Concierge

**Hackathon 2.0 — Problem #2 (Customer Experience, 78 pts)**

A unified post-sales AI bot that handles returns, warranty, lens issues,
order status, and more. Remembers context across conversations, proactively
reaches out on stale cases, and auto-resolves Salesforce cases with LLM + RAG.

---

## What it does (in one minute)

1. **Unified chat** — one bot handles every post-sales journey (returns, warranty,
   wrong power, order tracking, Gold membership, lens upgrades).
2. **Memory across conversations** — each customer has a persisted memory file;
   the bot recalls past issues + durable facts ("allergic to nickel", "prefers Hindi").
3. **RAG over Lenskart policies** — queries retrieve relevant policy passages
   (returns, warranty, lens replacement, etc.) and ground the response.
4. **Tool-use on Salesforce** — Claude decides when to auto-resolve a case,
   when to escalate, and writes the status back via the `update_case_status` tool.
5. **Proactive outreach** — a scheduled script scans stale open cases
   (>24 h untouched) and drafts WhatsApp follow-ups automatically.

## Architecture

```
┌──────────────────────────────────┐
│  React + Vite + Tailwind UI      │  http://localhost:5173
│  ├─ Banner + Metrics strip       │
│  ├─ Sidebar (customer + cases)   │
│  ├─ Chat area + tool trace       │
│  └─ Unified InputBar (hold mic)  │  ← Web Speech API (STT + TTS)
└────────────┬─────────────────────┘
             │ fetch /api/*
             ▼
┌──────────────────────────────────┐
│  FastAPI backend (server.py)     │  http://localhost:8000
│  GET /api/customers              │
│  POST /api/chat                  │
│  GET /api/customers/:id/cases    │
│  POST /api/customers/:id/memory  │
└────────────┬─────────────────────┘
             │
             ▼
  agent/concierge.py ──► Bedrock (Claude Sonnet 4.5)
    │  │  │                 │
    │  │  │                 └─ Tool-use loop
    │  │  └─ agent/knowledge.py   (RAG over data/policies/*.md)
    │  └─ agent/memory.py         (cross-convo memory → data/memory/*.json)
    └─ agent/salesforce_mock.py   (read/write data/cases.json)

scripts/proactive_outreach.py  →  daily stale-case scanner → WhatsApp drafts
```

## Setup (React + FastAPI, recommended)

```bash
# 1. Python deps
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt

# 2. Configure Bedrock credentials
cp .env.example .env
# edit .env — paste your Bedrock API key from the AWS console:
#   Bedrock → API keys → Generate short-term API key
# The app expects AWS_BEARER_TOKEN_BEDROCK (12h TTL, refresh as needed).

# 3. Frontend deps (one time)
cd frontend && npm install && cd ..

# 4. Run backend (terminal 1)
.venv/bin/uvicorn backend.server:app --reload --port 8000

# 5. Run frontend (terminal 2)
cd frontend && npm run dev
# → opens http://localhost:5173
```

### Alternative: Streamlit (quick demo)

The original Streamlit UI is still in [app.py](app.py):

```bash
.venv/bin/streamlit run app.py
```

### Proactive outreach script

```bash
.venv/bin/python scripts/proactive_outreach.py
```

### AWS Bedrock prerequisites

- Enable model access for **Claude Sonnet 4.5** (or Haiku/Sonnet 3.5) in the
  AWS console: Bedrock → Model access → Request access.
- Default region in `.env` is `us-east-1`. Mumbai (`ap-south-1`) currently only
  offers Claude 3.5 Haiku/Sonnet — change `BEDROCK_MODEL_ID` accordingly if you
  use that region. See `.env.example`.

## Demo script (what to show in the 3-min video)

1. **Open chat as Priya (C1001, Gold Member).** Ask: *"My blu-cut coating is peeling,
   what can I do?"* — bot recognises open case **SF-7001**, cites warranty policy,
   offers pickup, updates case to `Awaiting Customer`.
2. **Continue as Priya, new turn:** *"Also my sister wants to know if Gold membership
   can be shared."* — bot answers from `gold_membership.md` policy.
3. **Switch to Anjali (C1003).** Ask: *"I'm getting headaches with the new glasses."*
   — bot looks up her case **SF-7003**, recognises wrong-power symptoms,
   auto-resolves with free replacement + Rs 200 credit per policy.
4. **Run proactive outreach:** `python3 scripts/proactive_outreach.py` — shows
   drafted WhatsApp follow-ups for all stale open cases.
5. **Reopen Priya's chat in a new session** — bot remembers the coating issue
   from step 1 without re-asking.

## System prompt (excerpt)

See `agent/concierge.py` for the full system prompt. Key design:

> You handle ALL post-sales journeys for a customer … You have memory of every
> past conversation … Decide when you can AUTO-RESOLVE vs ESCALATE … After you
> auto-resolve, call `update_case_status` — don't just say you did it.

The agent has 3 tools:
- `get_customer_cases` — fetch customer's Salesforce history
- `update_case_status` — write-back: Resolved / Escalated / Awaiting Customer
- `remember_fact` — persist durable customer facts

## Business impact

**Before:** Avg post-sales ticket resolution = ~28 hours via human agent queue.
**After:** Auto-resolvable tickets closed in <2 minutes (conversationally).
**Delta:** ~70% of Tier-1 tickets auto-resolved → estimated ~Rs 1.2 Cr/yr CX cost
saving + NPS lift on resolution speed.

*(Figures based on Lenskart public CX volume estimates and typical LLM
 auto-resolution rates of 60–75% for Tier-1 post-sales queries.)*

## Assumptions & limitations

- Salesforce is mocked via `data/cases.json` — in prod, swap
  `agent/salesforce_mock.py` for Salesforce REST API calls (the interface is
  the same).
- RAG uses simple keyword overlap retrieval (sufficient for <10 policy docs).
  Production would use Bedrock Knowledge Base with OpenSearch.
- Memory is file-based JSON; in prod replace with DynamoDB (one table, PK =
  `customer_id`).
- Voice channel not implemented; easy to add via browser Web Speech API (STT
  + TTS) or Amazon Transcribe + Polly.
- International currency/language localisation kept minimal — Dubai customer
  has a basic Dirham fallback in the system prompt.

## Repo layout

```
.
├── app.py                         # Streamlit chat UI
├── agent/
│   ├── concierge.py               # Main agent (Bedrock + tool-use loop)
│   ├── knowledge.py               # RAG over policies
│   ├── memory.py                  # Cross-conversation memory
│   └── salesforce_mock.py         # Mock Salesforce case CRUD
├── data/
│   ├── customers.json             # 4 mock customers (India + UAE)
│   ├── cases.json                 # 5 mock cases (4 open, 1 resolved)
│   └── policies/                  # 5 markdown policy docs
├── scripts/
│   └── proactive_outreach.py      # Daily stale-case follow-up drafter
├── requirements.txt
├── .env.example
└── README.md
```
