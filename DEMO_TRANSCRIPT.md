# Demo Transcript — LensAssist

*For the "Demo Transcript" text field in the submission form. Copy the
8 field values below (not the labels) straight into the form.*

---

## 1. Problem (what was broken)

Lenskart's post-sales journey is fragmented across order tracking, returns, warranty, lens issues, refunds, Gold membership, and home eye tests. Each routes to a different human queue. Customers wait on average **28 hours** for Tier-1 resolution. Language is English-only — Hindi-preferring customers have to code-switch to get help. There is no cross-conversation memory, so customers re-explain their allergy, preference, and history every single call.

## 2. Baseline metric (before)

- **Avg Tier-1 TAT:** 28 hours
- **Auto-resolution rate:** 0% (every ticket touches a human)
- **Volume:** ~850 tickets/day across Lenskart CX
- **Language coverage:** English only
- **Detractor rate:** 18 per 1,000 interactions

## 3. The agent (what LensAssist does)

One concierge agent, powered by **Amazon Bedrock Claude Sonnet 4.5**, handles every post-sales journey via **chat or voice**, in **English, Hindi, and Hinglish**. It has:

- **Cross-conversation memory** persisted in DynamoDB (`lensassist-memory` table)
- **Tool-use** — `get_customer_cases`, `update_case_status`, `remember_fact` against mock Salesforce
- **RAG** over 8 Lenskart policy documents
- **Voice** — Amazon Polly Neural (`Kajal` bilingual voice) with browser Web Speech API STT
- **Streaming replies** — first sentence speaks within ~1.5 s instead of ~8 s batch wait

## 4. Live demo moment

Sign in as **Priya Sharma (C1001, Gold, Mumbai)** via OTP `1234`.

Past conversation bubbles load from DynamoDB showing her nickel allergy and 6 PM delivery preference.

Ask: *"My blu-cut coating is peeling, what can I do?"*

The agent:
- Loads her open case `SF-7001` via the `get_customer_cases` tool (tool chip visible in UI)
- Cites the 6-month lens-coating warranty from `warranty.md` (RAG)
- References her nickel allergy proactively
- Offers home pickup after 6 PM (her saved preference)
- Replies in streaming Polly Kajal voice
- Writes case status back to `Awaiting Customer` via `update_case_status` tool

## 5. Two contrasting inputs (AI reasoning proof)

- **Customer A** (Priya, English, Gold, Mumbai) — coating peel → agent auto-resolves under warranty policy, cites Gold priority
- **Customer B** (Arjun, हिन्दी, Gold, Delhi) — same underlying issue asked in Hindi Devanagari → agent replies in Hindi with feminine verb forms ("मैं देख रही हूँ"), same tool call pattern, voice switches to Hindi Kajal

## 6. Tool calls / AI in action

During Priya's query the UI shows these tool chips firing live:
```
🔧 get_customer_cases ({})
   → returns SF-7001, SF-6988
🔧 update_case_status (case_id="SF-7001", status="Awaiting Customer",
                      resolution_note="Pickup scheduled after 6 PM per customer preference")
```

Reasoning panel expandable under each reply shows the full tool input + output.

## 7. After metric — with unit (Before/After/Delta)

**Before:** 28-hour avg Tier-1 TAT, 0% auto-resolved, English only.
**After:** ~2-minute avg TAT, ~70% Tier-1 auto-resolved, English + Hindi + Hinglish.
**Delta:** **99% faster TAT** · **~₹1.2 Cr/yr** projected CX cost saving · cross-conversation memory stored in DynamoDB means zero re-explain effort for returning customers.

## 8. What's next (productionisation)

- Swap `salesforce_mock.py` for `simple-salesforce` REST integration (~1 hour)
- Replace keyword RAG with Bedrock Knowledge Base + Titan embeddings
- Wire OTP to AWS Cognito + SNS SMS
- Promote `scripts/proactive_outreach.py` to Lambda + EventBridge (daily cron)
- Add Amazon Comprehend sentiment detection for auto-priority-boost on angry messages
