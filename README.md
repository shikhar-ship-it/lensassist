# LensAssist — Lenskart Post-Sales AI Concierge

**Hackathon 2.0 · Problem #2 (Customer Experience, 78 pts)**
*Unified Post-Sales Bot — voice + chat, multilingual, memory, tool-use on Salesforce*

Live deployment: https://{your-app-runner-domain}.us-east-1.awsapprunner.com
Repo: GitLab internal at `gitlab.hackathon.lenskart.com/hackathon-april-26/hackathon-shikhar-ai`

---

## What it does

LensAssist is a single AI concierge that handles **every post-sales journey** a Lenskart customer can have:

- **Returns & refunds** (standard + stuck refund escalation)
- **Warranty claims** (frame hinges, lens coating, international)
- **Order tracking** (EDD, stuck-in-transit, wrong-address, customs)
- **Lens issues** (wrong power, adaptation failure, coating peel, lens upgrade)
- **Gold membership** (benefits, renewal, family add-on)
- **Payments** (EMI double-charge, price drop, refund delays)
- **Home eye test** (booking, cancellations, escalation)

All through a **single chat interface** with optional **voice in / voice out** in **English + Hindi + Hinglish**.

## The 6 capabilities

1. **Cross-conversation memory** — every customer has a DynamoDB-persisted record of past turns + durable facts ("allergic to nickel", "prefers Hindi"). The agent references these immediately on sign-in.
2. **Tool-use on mock Salesforce** — agent fetches cases, decides to auto-resolve vs escalate, writes the status back. 3 tools: `get_customer_cases`, `update_case_status`, `remember_fact`.
3. **RAG over Lenskart policies** — 8 policy documents (returns, warranty, lens, Gold, EMI, home eye test, international, order status) retrieved per query and grounded into the reply.
4. **Multilingual** — English, Hindi (Devanagari), Hinglish (Roman) auto-detected; agent replies in the same language and TTS switches voice.
5. **Proactive outreach** — scheduled script scans stale open cases (>24 h) and drafts WhatsApp-style follow-ups.
6. **Live admin panel** — CX admins can edit policies/cases/customers in real time. Policy edits hot-reload the RAG cache; the very next chat uses the new content. All edits persist to DynamoDB.

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│  React + Vite + Tailwind                                         │
│  • Login (customer OTP + admin password)                         │
│  • Chat (streaming, voice in/out, hold-to-speak, Hindi-aware)    │
│  • Admin panel (policies / cases / customers — paginated CRUD)   │
└──────────────────────────────────┬───────────────────────────────┘
                                   │ /api/* (Bearer JWT)
                                   ▼
┌──────────────────────────────────────────────────────────────────┐
│  FastAPI (Python 3.12)                                           │
│   • POST /api/auth/{request-otp, verify, admin}                  │
│   • POST /api/chat + /api/chat/stream (SSE)                      │
│   • GET  /api/customers, /api/customers/:id/cases, /memory      │
│   • POST /api/tts  →  Amazon Polly (Kajal Neural)               │
│   • Admin: GET/PUT/DELETE /api/admin/{policies,cases,customers} │
└────┬───────────────────┬────────────────────┬───────────────────┘
     │                   │                    │
     ▼                   ▼                    ▼
AWS Bedrock         Amazon Polly         DynamoDB (4 tables)
Claude Sonnet 4.5   Kajal Neural         ├─ lensassist-customers
(ReAct loop +       (en-IN / hi-IN)      ├─ lensassist-cases
 streaming)         servlet on /api/tts  ├─ lensassist-policies
     │                                   └─ lensassist-memory
     │
     └─ Tools: get_customer_cases · update_case_status · remember_fact
        RAG: keyword retrieval over policies (cached in memory, hot-reload on edit)
```

## System prompt (core)

```
You are "LensAssist", Lenskart's AI post-sales concierge.

You handle ALL post-sales journeys for a customer … You have memory of every
past conversation with this customer and full access to their Salesforce cases.

Your mission on every turn:
1. Read the customer profile and memory FIRST before responding.
2. If the customer asks about an issue that is already an open case, reference
   it by case ID instead of creating a parallel thread.
3. Use the policy context to give accurate answers — never invent policy terms.
4. Decide when you can AUTO-RESOLVE vs ESCALATE.
5. Use the available tools … After you auto-resolve, call update_case_status —
   don't just say you did it.

LANGUAGE POLICY:
- Detect language and REPLY IN THE SAME LANGUAGE.
- Devanagari → reply in Hindi; Roman Hindi → reply in Hinglish; otherwise Indian English.
- Keep product names and case IDs in English.

GENDER: You speak with a FEMALE voice — always use feminine self-reference
verbs in Hindi ("कर रही हूँ" not "कर रहा हूँ").

FORMATTING: No emojis, no markdown. Short rhythmic sentences — replies are
spoken aloud by TTS.
```

Full prompt in [agent/concierge.py](agent/concierge.py).

## Setup (≤ 5 commands)

```bash
# 1. Python deps
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt

# 2. Frontend deps
cd frontend && npm install && cd ..

# 3. Configure credentials (.env)
cp .env.example .env
# edit .env — set AWS_BEARER_TOKEN_BEDROCK, AWS_ACCESS_KEY_ID/SECRET (for Polly + DynamoDB),
# and MEMORY_BACKEND=dynamodb (or leave as json for local-only)

# 4. Start backend (terminal 1)
.venv/bin/uvicorn backend.server:app --reload --port 8000

# 5. Start frontend (terminal 2)
cd frontend && npm run dev
# → http://localhost:5173
```

### Login credentials

- **Customer (OTP)**: phone `9876543210` (Priya) → OTP `1234`
  - Other demo phones: `9000011111` (Rahul), `9811122334` (Arjun, Hindi), `9888877665` (Meera)
- **Admin**: `admin@lenskart.com` / `demo123`

### Optional — one-time DynamoDB seed
```bash
.venv/bin/python scripts/seed_memory.py   # populates 17 customers with prior memory
.venv/bin/python scripts/proactive_outreach.py   # runs stale-case scanner
```

## AWS services used

| Service | Used for |
|---|---|
| **Bedrock** (Claude Sonnet 4.5, inference profile `us.anthropic.claude-sonnet-4-5-20250929-v1:0`) | Agent reasoning, tool-use, streaming generation |
| **Polly Neural** (`Kajal` voice) | Bilingual Indian English + Hindi TTS |
| **DynamoDB** (4 tables — see below) | All persistent state |
| **ECR + App Runner** | Container hosting, HTTPS domain, auto-scaling |
| **IAM** | Instance role for credential-less AWS calls from container |
| **GitHub Actions + ECR** | Auto-build + auto-deploy on push to `main` |

## Data architecture

**Source of truth = DynamoDB.** All persistent state lives in 4 tables in `us-east-1`. The `data/` folder in this repo contains **seed data only** — it bootstraps fresh deployments, gives a file fallback for local dev without AWS creds, and documents the schema. Once a table has rows, files are no longer read from. **Edits via the admin panel write directly to DynamoDB and persist across container restarts.**

| Table | PK | Seed source | Purpose |
|---|---|---|---|
| `lensassist-customers` | `customer_id` | `data/customers.json` | Customer profiles (20 seeded) |
| `lensassist-cases` | `case_id` | `data/cases.json` | Salesforce-mock case records (24 seeded) |
| `lensassist-policies` | `name` | `data/policies/*.md` | Lenskart policy documents (8 seeded) |
| `lensassist-memory` | `customer_id` | `scripts/seed_memory.py` | Cross-conversation memory + remembered facts |

Tables auto-create on first read if missing. Auto-seed runs once when a table is empty.

## Business impact

**Before:** Avg post-sales ticket resolution = **~28 hours** via human agent queue. 850 tickets/day across Lenskart CX.

**After:** Auto-resolvable tickets closed in **~2 minutes** conversationally, bot matches the tone a human CX rep would use.

**Delta:** ~70% of Tier-1 tickets auto-resolve → estimated **~₹1.2 Cr/yr** CX FTE saving + NPS lift on first-contact-resolution speed.

*(Numbers based on Lenskart public volume figures and typical 60–75% LLM auto-resolution rate for Tier-1 queries.)*

## Assumptions & production path

- Salesforce is mocked via `data/cases.json` — [agent/salesforce_mock.py](agent/salesforce_mock.py) is a ~30-line interface-compatible shim; swap for `simple-salesforce` REST calls in prod.
- RAG uses keyword overlap retrieval over markdown. Production would use **Bedrock Knowledge Base** with Titan embeddings for semantic search.
- OTP is hardcoded to `1234` for demo. Production: **AWS Cognito User Pools + SNS SMS**.
- IAM instance role attached to App Runner means **no long-lived credentials in the container** — IMDS auto-rotates.

## Repo layout

```
.
├── frontend/                       # React + Vite + TS + Tailwind
│   └── src/
│       ├── App.tsx                 # Top-level app + auth gate
│       ├── components/             # Banner, Sidebar, ChatArea, InputBar, ToolTrace, Login, AdminPanel
│       └── hooks/                  # useVoiceInput (hold-to-speak), useVoiceOutput (Polly + browser fallback)
├── backend/
│   ├── server.py                   # FastAPI routes: auth, chat (SSE streaming), TTS, admin CRUD
│   └── auth.py                     # JWT, OTP, admin login, per-customer ownership
├── agent/
│   ├── concierge.py                # Claude agent + tool-use loop + streaming generator
│   ├── knowledge.py                # RAG retrieval (in-memory cache, hot-reloads on edits)
│   ├── memory.py                   # DynamoDB / file-fallback cross-conversation memory
│   ├── storage.py                  # Unified DynamoDB layer (customers, cases, policies)
│   └── salesforce_mock.py          # Salesforce-shaped wrapper around storage layer
├── data/                           # SEED DATA only — runtime state lives in DynamoDB
│   ├── customers.json              # 20 customers (India + UAE + SG + TH + KSA)
│   ├── cases.json                  # 24 Salesforce cases
│   └── policies/                   # 8 Lenskart policy markdown docs
├── scripts/
│   ├── seed_memory.py              # Seed DynamoDB with 17 customers' past memory
│   └── proactive_outreach.py       # Stale-case scanner → WhatsApp drafts
├── Dockerfile                      # Multi-stage: Node build + Python runtime
├── .github/workflows/deploy.yml    # GitHub Actions: build → ECR → App Runner
├── .gitlab-ci.yml                  # GitLab CI alternative
├── requirements.txt
├── APPROACH_NOTE.md                # Submission 1-pager
├── DEMO_TRANSCRIPT.md              # Submission 8-field transcript
├── DEMO_SCRIPT.md                  # 3-min video storyboard
└── README.md
```
