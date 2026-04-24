# H2_QD_83_2_ApproachNote

**Problem #2 — AI Personal Concierge (Unified Post-Sales Bot)**
*Customer Experience · Base points: 78 · Submitted by: Shikhar Srivastava*

---

## 1. Problem Statement

Lenskart's post-sales journey today is **fragmented across channels, slow, and human-gated**. A customer with a bent frame hinge, a wrong-power lens, a stuck refund, and a Gold-membership query has to navigate four different queues with four different agents. Average Tier-1 ticket resolution takes **~28 hours** across ~850 tickets/day, and 18 in 1000 interactions leave a detractor.

**Baseline metric:** 28-hour avg TAT · 0% auto-resolution · single-language CX.

## 2. Our Solution — LensAssist

A **single AI concierge** that handles every post-sales journey the customer can have, via **chat or voice**, in **English / Hindi / Hinglish**. The agent remembers every past conversation, reads the customer's Salesforce cases, and can auto-resolve or escalate with the right policy reasoning.

**Agent workflow per turn:**
1. Retrieve customer profile + cross-conversation memory + remembered facts from DynamoDB
2. Retrieve top-3 relevant policy documents (RAG)
3. Invoke Claude Sonnet 4.5 with streaming + tool-use loop
4. Agent decides: reply directly OR call `get_customer_cases`, `update_case_status`, or `remember_fact` tool
5. Stream response token-by-token; as each sentence completes, fire Polly TTS so user hears the reply ~1.5 s after starting instead of ~8 s batch
6. Persist new turn + any new facts back to DynamoDB

**AI technique**: ReAct-style tool-use loop with Claude Sonnet 4.5; streaming SSE to browser; sentence-level TTS queueing for near-real-time voice; bilingual self-consistent personification ("feminine Hindi verbs" for the Kajal voice).

## 3. Tech Stack

| Layer | Tool |
|---|---|
| Agent reasoning | Amazon Bedrock · Claude Sonnet 4.5 (`us.anthropic.claude-sonnet-4-5-20250929-v1:0`) |
| Voice — TTS | Amazon Polly Neural (`Kajal` bilingual Indian voice) |
| Voice — STT | Browser Web Speech API (`en-IN` / `hi-IN`) |
| Memory | Amazon DynamoDB (`lensassist-memory`, PK = `customer_id`) |
| RAG | Python, keyword-overlap retrieval over 8 Lenskart policy docs (markdown) |
| Backend | FastAPI + SSE streaming (Python 3.12), JWT auth |
| Frontend | React 18 + Vite + TypeScript + Tailwind |
| Hosting | AWS App Runner (container), IAM instance role, HTTPS default |
| Container registry | Amazon ECR |
| CI/CD | GitLab CI → Docker build → ECR push → App Runner auto-deploy |
| Salesforce (mock) | JSON file with same interface as `simple-salesforce` — one-file swap for prod |

## 4. Business Impact

**Before:** 28-hour avg Tier-1 TAT · human agent queue · English-only
**After:** ~2-minute avg TAT · ~70% Tier-1 auto-resolved · English + Hindi + Hinglish
**Delta:** 99% faster TAT · ~**₹1.2 Cr/yr** projected CX cost saving (estimated from reduced FTE demand at 70% auto-resolution × 850 tickets/day) · NPS lift on first-contact-resolution speed.

Secondary impact:
- **Multilingual coverage** extends to UAE, Saudi, Singapore, Thailand customers
- **Gender-correct Hindi voice** — addresses a real quality gap in existing Indian voice assistants
- **Agent memory** surfaces allergies, preferences, past complaints automatically → closes empathy gap

## 5. Assumptions & Limitations

- **Salesforce** is mocked via [`agent/salesforce_mock.py`](agent/salesforce_mock.py); interface-compatible swap to real Service Cloud REST API is ~1 hour of work.
- **RAG** uses keyword overlap (sufficient for 8 docs). Production path: Amazon Bedrock Knowledge Base with Titan embeddings.
- **OTP** is hardcoded to `1234` for demo. Production: AWS Cognito User Pools + SNS SMS.
- **Proactive outreach** runs as a local script; production would be Lambda + EventBridge cron.
- **Demo data** (customers, cases, policies) is synthetic — submission guidelines allow this.

## 6. Deployment

- Containerized (multi-stage Dockerfile: Node build → Python runtime), single port 8000
- **AWS App Runner** with IAM instance role (no credentials in container)
- **GitLab CI** pipeline: push to `main` → auto-build → push to ECR → App Runner auto-deploys within 1 min
- Dev and prod use the **same backend code** — only `MEMORY_BACKEND` env var differs

## 7. Links

- Repo: `gitlab.hackathon.lenskart.com/hackathon-april-26/hackathon-shikhar-ai`
- Live URL: `https://<apprunner-domain>.us-east-1.awsapprunner.com`
- Demo video: `<Google Drive link>`

---
*Prepared 24 April 2026 by Shikhar Srivastava.*
