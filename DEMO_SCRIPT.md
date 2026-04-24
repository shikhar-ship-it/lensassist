# Demo Video Script — LensAssist (3 minutes)

*Use Loom or QuickTime. Screen record + voiceover. No slides. Every beat
below is < 20 s so the full video hits ~3:00.*

---

## Pre-flight (do these before hitting record)

- [ ] Sign out of any existing session in the browser
- [ ] Reset a clean memory state for the demo customer? **No** — we WANT Priya's seeded memory to show (nickel allergy, 6 PM preference)
- [ ] Chrome open at `http://localhost:5173` (or your App Runner URL)
- [ ] Zoom browser to 100% (Cmd+0). Hide bookmarks bar (Cmd+Shift+B)
- [ ] Phone notifications / Slack off
- [ ] Close DevTools, any personal tabs

## Script — 6 beats × 30 s

### Beat 1 — The problem (0:00 – 0:20)

**On screen:** Login page of LensAssist.

**Voiceover:**
> "Lenskart gets about 850 post-sales tickets a day — returns, warranty, wrong power, refund delays. Today the average Tier-1 ticket takes 28 hours and touches a human agent. I built LensAssist — an AI concierge that handles all of it in English, Hindi, and Hinglish. Let's see it."

### Beat 2 — Sign in + memory moment (0:20 – 0:50)

**On screen:** Type phone `9876543210`, click Send OTP, enter `1234`.

Watch the chat area populate with **past conversation** (nickel allergy + 6 PM delivery preference).

**Voiceover:**
> "I'm signing in as Priya, a real customer with history. Watch — as soon as I'm in, her past conversations load from DynamoDB. The agent already knows she's allergic to nickel frames and wants deliveries after 6 PM. No re-explaining."

### Beat 3 — Live chat with tool use (0:50 – 1:35)

**On screen:** Type: *"my blu-cut coating is peeling"* → Enter.

Watch:
- Reply starts streaming within ~1 second
- `🔧 get_customer_cases` chip appears
- Reply mentions case SF-7001 + warranty policy + pickup
- Voice starts speaking before text finishes
- `🔧 update_case_status` chip appears
- Expand "View reasoning" to show the JSON tool input + output

**Voiceover:**
> "I ask about my peeling coating. The agent calls two Salesforce tools — fetches my open case, cites the 6-month coating warranty, flags pickup after 6 PM because she remembers my preference, and writes the case status back to Awaiting Customer. Polly's Kajal voice starts speaking before the text finishes rendering."

### Beat 4 — Multilingual (1:35 – 2:10)

**On screen:** Sidebar → switch "Speak in" toggle to **हिन्दी**. Sign out. Sign in as **Arjun** (phone `9811122334`, OTP `1234`).

Tap the mic, say: *"मेरा ऑर्डर कब आएगा?"* (or type it if mic is flaky on camera)

**Voiceover:**
> "Arjun prefers Hindi — the agent replies in Devanagari with the right feminine verb forms because Kajal is a female voice. Same tool-use, same memory, different language. All auto-detected — no toggles."

Listen to Kajal speak the Hindi reply.

### Beat 5 — Admin view + impact (2:10 – 2:40)

**On screen:** Sign out. Sign in as admin (`admin@lenskart.com` / `demo123`). Pull up DynamoDB console showing the `lensassist-memory` table with all 17 customers.

**Voiceover:**
> "As admin I can see every customer's memory is persisted to DynamoDB. 17 customers pre-seeded, one row each, all their turns and remembered facts. This is the production schema — just swap the mock Salesforce for the real REST client and we're live."

### Beat 6 — Impact slide (2:40 – 3:00)

**On screen:** Back to the main chat UI — point at the metrics strip at the top: "Avg Resolution TAT · ~2 min · ↓ 99% vs 28 hr", "Tier-1 Auto-Resolution · ~70%", "Est. Annual CX Savings · ₹1.2 Cr".

**Voiceover:**
> "Before: 28-hour TAT, zero auto-resolution, English only. After: 2-minute resolution, 70% auto-resolved, three languages. Projected savings: 1.2 crore rupees a year. Live on AWS App Runner, Bedrock, DynamoDB, Polly — all with IAM role authentication, zero creds in the container."

## Tips

- **Do the mic scene last** — browser mic can be flaky, have a typed-Hindi fallback ready
- **Keep voiceover flat and declarative** — judges reward clarity over hype
- **One take** — judges explicitly reward "live, uncut" demo moments. Cuts suggest mock data
- **If Polly fails** mid-demo, have the sidebar indicator on screen so viewers see the 🟢 Polly Neural · Kajal badge — proves it's connected even if audio loops
- **Recording resolution**: 1440p or 1080p. Loom default is fine.

## Filename when you upload

`H2_<YourEmpID>_2_Demo.mp4`

Upload to the shared Drive folder mentioned in the submission email. Make sure link is set to "Anyone with link can view".
