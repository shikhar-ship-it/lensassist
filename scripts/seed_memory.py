"""Seed DynamoDB (or local JSON) with realistic prior memory for each customer.

Gives every customer a couple of prior turns + a few remembered facts so the
demo showcases cross-conversation memory even on the very first query.

Run:
    .venv/bin/python scripts/seed_memory.py
"""
from __future__ import annotations
import sys
from datetime import datetime, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from dotenv import load_dotenv

load_dotenv()

from agent import memory  # noqa: E402


def _ts(days_ago: int, hour: int = 14) -> str:
    return (datetime.utcnow() - timedelta(days=days_ago)).replace(
        hour=hour, minute=0, second=0, microsecond=0
    ).isoformat()


SEED: dict[str, dict] = {
    "C1001": {
        "facts": [
            "prefers delivery slots after 6 PM (works till 6)",
            "allergic to nickel frames — confirmed after Vincent Chase frame issue",
            "daughter also uses Lenskart — Gold family add-on discussed",
        ],
        "turns": [
            ("customer", "My previous frame was causing skin irritation near the nose", _ts(18)),
            ("agent", "Noted, Priya — that was a nickel allergy issue. I've flagged your profile so future frame recommendations skip nickel-based alloys.", _ts(18)),
            ("customer", "Can you always send delivery after 6 PM? I'm in office till then", _ts(12)),
            ("agent", "Absolutely — I've saved this to your profile. All future orders will be scheduled for evening delivery slots.", _ts(12)),
        ],
    },
    "C1002": {
        "facts": [
            "prefers WhatsApp channel for updates, not email",
            "first-time progressive lens user",
        ],
        "turns": [
            ("customer", "please update me on WhatsApp not email, I don't check email much", _ts(20)),
            ("agent", "Got it, Rahul — switched your notification preference to WhatsApp.", _ts(20)),
            ("customer", "is this my first progressive pair? I'm nervous", _ts(10)),
            ("agent", "Yes, this is your first progressive lens. I'll share the 30-day adaptation guide and we have a no-questions-asked switch-back to single-vision if you don't adapt in a month.", _ts(10)),
        ],
    },
    "C1003": {
        "facts": [
            "could not adapt to progressive lenses in March 2026 — switched to single vision",
            "Kochi-based, prefers home pickup over store visit (no time to travel)",
            "wants ultra-thin high-index lenses due to high power",
        ],
        "turns": [
            ("customer", "the progressive lens is giving me vertigo", _ts(35)),
            ("agent", "Anjali, I'm switching you back to single-vision today under the 30-day adaptation guarantee. Upgrade charge will be refunded.", _ts(35)),
            ("customer", "can you always do home pickup and delivery? I can't travel to the store", _ts(22)),
            ("agent", "Saved that to your profile — all future returns, replacements, and pickups will be scheduled at your Kochi home address.", _ts(22)),
        ],
    },
    "C1004": {
        "facts": [
            "based in Dubai — UAE warranty queries route to Mall of Emirates store",
            "prefers English, not Arabic",
        ],
        "turns": [
            ("customer", "I live in Dubai now — how do warranty claims work here?", _ts(15)),
            ("agent", "Mohammed, you can walk into the Mall of Emirates or Ibn Battuta Lenskart store for warranty service — same coverage as India. Free return shipping if you prefer courier.", _ts(15)),
        ],
    },
    "C1005": {
        "facts": [
            "prefers Hindi communication (हिन्दी में बात करना पसंद है)",
            "high-power prescription — needs 1.67 high-index lenses minimum",
            "works night shifts, needs blue-cut + anti-glare always",
        ],
        "turns": [
            ("customer", "मुझे Hindi में बात करना है, English में confusion होता है", _ts(25)),
            ("agent", "जी अर्जुन जी, अब से मैं आपसे Hindi में ही बात करूँगी। आपकी profile पर Hindi preference save कर दी है।", _ts(25)),
            ("customer", "रात में काम करता हूँ, आँखों में बहुत strain होता है", _ts(14)),
            ("agent", "समझ गई। मैंने आपकी profile पर note कर दिया है — हर order में blue-cut और anti-glare coating default रहेगी।", _ts(14)),
        ],
    },
    "C1006": {
        "facts": [
            "refund-sensitive — had a long-delayed refund in April 2026",
            "prefers email over SMS",
        ],
        "turns": [
            ("customer", "my last refund took 13 days, very frustrating", _ts(8)),
            ("agent", "Meera, I've flagged your account for priority refund processing on any future returns. Apology credit of Rs 200 added to your wallet.", _ts(8)),
        ],
    },
    "C1007": {
        "facts": [
            "home eye test was cancelled twice — escalated to Jaipur regional ops",
            "prefers Hindi and WhatsApp",
            "Gold member — entitled to quarterly free home eye test",
        ],
        "turns": [
            ("customer", "home eye test दो बार cancel हो गया, क्या हो रहा है", _ts(4)),
            ("agent", "विक्रम जी, Jaipur regional ops team को मैंने directly escalate कर दिया है। अगला slot confirmed होगा, और Rs 500 apology credit आपके wallet में आ गया है।", _ts(4)),
        ],
    },
    "C1008": {
        "facts": [
            "adapting to progressive lenses — reported dizziness on day 10",
            "high cylinder power, sensitive to lens fitting quality",
        ],
        "turns": [
            ("customer", "progressive lens lagane ke baad chakkar aate hain", _ts(7)),
            ("agent", "Sneha ji, ye adjustment phase mein normal hai. 30-day adaptation guarantee hai — agar 3 hafte mein theek nahi hota, hum single-vision pe switch kar denge bina koi extra charge.", _ts(7)),
        ],
    },
    "C1009": {
        "facts": [
            "senior citizen, progressive lens user",
            "farsighted (+2.00 / +2.25) — reads a lot, needs premium anti-reflective coating",
            "prefers home delivery, Hyderabad address",
        ],
        "turns": [
            ("customer", "I read 2-3 hours every evening, lens should not strain my eyes", _ts(30)),
            ("agent", "Understood, Ravi sir. I've added premium anti-reflective coating as your default for all future orders. It reduces eye fatigue during long reading sessions.", _ts(30)),
        ],
    },
    "C1010": {
        "facts": [
            "student, budget-conscious customer — showed under Rs 3000 frames last time",
            "first Lenskart order",
        ],
        "turns": [
            ("customer", "I'm a student, please show me frames under 3000", _ts(6)),
            ("agent", "Got it, Kavya. I've filtered future recommendations to under Rs 3000. Student offer: Gold membership is 50% off for students — want me to apply that?", _ts(6)),
        ],
    },
    "C1011": {
        "facts": [
            "highest-LTV Gold member — consistently orders premium frames",
            "prefers Hindi; Kolkata-based",
            "wife and 2 children also use Lenskart (potential family Gold add-on)",
        ],
        "turns": [
            ("customer", "हमेशा premium frame ही दिखाइए, budget की चिंता नहीं है", _ts(45)),
            ("agent", "अमित जी, आपकी profile पर premium-only preference save कर दी है। और आप Gold family add-on के लिए पत्नी और बच्चों को add कर सकते हैं, सिर्फ Rs 200 per member।", _ts(45)),
        ],
    },
    "C1012": {
        "facts": [
            "needs reading glasses only (+1.25 / +1.50)",
            "Pune office worker, prefers store pickup over home delivery",
        ],
        "turns": [
            ("customer", "I only need reading glasses for laptop work", _ts(12)),
            ("agent", "Noted, Deepika. I've saved reading-only as your use case. Future order recommendations will focus on computer/reading-specific frames with blue-cut.", _ts(12)),
        ],
    },
    "C1013": {
        "facts": [
            "first-time Lenskart customer — ordered a zero-power blue-cut frame",
            "had OTP/login issues during onboarding",
        ],
        "turns": [
            ("customer", "first time buying glasses, don't even need power, just blue-cut", _ts(2)),
            ("agent", "Welcome to Lenskart, Harsh! I've saved that you're a zero-power blue-cut user. Any questions about blue-cut benefits or fit, I'm here.", _ts(2)),
        ],
    },
    "C1014": {
        "facts": [
            "prefers Hindi always",
            "Lucknow-based, no nearby store — always orders online",
            "Gold member",
        ],
        "turns": [
            ("customer", "Lucknow में Lenskart store नहीं है पास में, हमेशा online ही order करती हूँ", _ts(28)),
            ("agent", "शालिनी जी, मैंने आपकी profile पर online-only preference note कर ली है। हर order पर free home try-on दे सकती हूँ Gold benefit के तहत।", _ts(28)),
        ],
    },
    "C1015": {
        "facts": [
            "Singapore-based — international shipping times tracked separately",
            "Gold member — expects 7-10 day international delivery",
        ],
        "turns": [
            ("customer", "my order is taking longer than expected for Singapore", _ts(5)),
            ("agent", "Wei Ming, international orders to Singapore typically take 7-10 business days. Your current order is at day 5. I'm monitoring — will escalate if no movement by day 7.", _ts(5)),
        ],
    },
    "C1016": {
        "facts": [
            "Bangkok-based, visits Bangkok for work frequently",
            "wants local lens replacement option in Thailand",
        ],
        "turns": [
            ("customer", "I'm in Bangkok — is there a local Lenskart service?", _ts(3)),
            ("agent", "Somchai, Thailand is online-only for now — no physical Lenskart stores. But international warranty claims ship to our Singapore hub with free return shipping. I've saved this to your profile.", _ts(3)),
        ],
    },
    "C1017": {
        "facts": [
            "Riyadh-based Gold member",
            "requested women-specific frame recommendations in previous orders",
        ],
        "turns": [
            ("customer", "please show me elegant women's frames, not unisex", _ts(20)),
            ("agent", "Fatima, saved to your profile. Future recommendations will focus on women-specific frame collections — John Jacobs women, Vincent Chase Luxe, and Aqualens designer ranges.", _ts(20)),
        ],
    },
}


def seed() -> None:
    info = memory.backend_info()
    print(f"Seeding memory — backend: {info}\n")
    for cid, data in SEED.items():
        state = {
            "customer_id": cid,
            "turns": [
                {"role": role, "text": text, "at": at}
                for role, text, at in data["turns"]
            ],
            "facts": data["facts"],
        }
        memory.save(cid, state)
        print(f"  ✓ {cid}: {len(state['turns'])} turns, {len(state['facts'])} facts")
    print(f"\nDone. Seeded {len(SEED)} customers.")


if __name__ == "__main__":
    seed()
