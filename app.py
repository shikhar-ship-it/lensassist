"""Streamlit demo UI for Lenskart Post-Sales Concierge."""
from __future__ import annotations
import json
from datetime import date
from pathlib import Path

import streamlit as st
import streamlit.components.v1 as components
from streamlit_mic_recorder import speech_to_text

from agent import concierge, memory, salesforce_mock

st.set_page_config(
    page_title="LensAssist — Lenskart Post-Sales Concierge",
    page_icon="👓",
    layout="wide",
    initial_sidebar_state="expanded",
)

CUSTOMERS_FILE = Path(__file__).parent / "data" / "customers.json"

# ──────────────────────────────────────────────────────────────────────────
# CSS
# ──────────────────────────────────────────────────────────────────────────
CSS = """
<style>
  /* Hide default streamlit chrome */
  #MainMenu, footer, header { visibility: hidden; }

  .block-container {
      padding-top: 1.4rem;
      padding-bottom: 2rem;
      max-width: 1280px;
  }

  /* Top banner */
  .brand-banner {
      background: linear-gradient(135deg, #0B1F3A 0%, #2F58CD 100%);
      color: white;
      padding: 18px 24px;
      border-radius: 14px;
      display: flex;
      align-items: center;
      gap: 16px;
      margin-bottom: 18px;
      box-shadow: 0 6px 24px rgba(11,31,58,0.15);
  }
  .brand-logo {
      font-size: 28px;
      background: rgba(255,255,255,0.15);
      width: 54px; height: 54px;
      border-radius: 12px;
      display: flex; align-items: center; justify-content: center;
      backdrop-filter: blur(8px);
  }
  .brand-title { font-size: 22px; font-weight: 700; margin: 0; letter-spacing: -0.3px; }
  .brand-subtitle { font-size: 13px; opacity: 0.85; margin: 2px 0 0 0; }

  /* Metrics row */
  .metrics-row {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 12px;
      margin-bottom: 20px;
  }
  .metric-card {
      background: #F4F6FB;
      border-left: 4px solid #2F58CD;
      border-radius: 10px;
      padding: 12px 16px;
  }
  .metric-card.success { border-left-color: #12B76A; }
  .metric-card.warning { border-left-color: #F79009; }
  .metric-card.accent  { border-left-color: #B54708; }
  .metric-label { font-size: 11px; color: #475467; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600; }
  .metric-value { font-size: 20px; font-weight: 700; color: #0B1F3A; margin-top: 4px; }
  .metric-delta { font-size: 11px; color: #12B76A; margin-top: 2px; font-weight: 500; }

  /* Customer card in sidebar */
  .cust-card {
      background: linear-gradient(135deg, #F4F6FB 0%, #ffffff 100%);
      border: 1px solid #E4E7EC;
      border-radius: 12px;
      padding: 14px;
      margin-bottom: 10px;
  }
  .cust-avatar {
      width: 40px; height: 40px;
      border-radius: 50%;
      background: linear-gradient(135deg, #2F58CD, #0B1F3A);
      color: white;
      font-weight: 700;
      display: inline-flex;
      align-items: center; justify-content: center;
      font-size: 16px;
      margin-right: 10px;
      vertical-align: middle;
  }
  .cust-name  { font-weight: 700; font-size: 15px; color: #0B1F3A; }
  .cust-meta  { font-size: 12px; color: #667085; margin-top: 2px; }
  .gold-pill  {
      display: inline-block;
      background: linear-gradient(135deg, #FFD700, #FFA500);
      color: #4B2800;
      font-size: 10px; font-weight: 700;
      padding: 2px 8px; border-radius: 20px;
      margin-top: 6px;
      letter-spacing: 0.5px;
  }

  /* Case cards */
  .case-card {
      background: white;
      border: 1px solid #E4E7EC;
      border-radius: 10px;
      padding: 10px 12px;
      margin-bottom: 8px;
      border-left-width: 4px;
  }
  .case-card.High   { border-left-color: #D92D20; }
  .case-card.Medium { border-left-color: #F79009; }
  .case-card.Low    { border-left-color: #667085; }
  .case-id   { font-size: 11px; font-weight: 700; color: #2F58CD; letter-spacing: 0.3px; }
  .case-subj { font-size: 13px; color: #0B1F3A; margin-top: 2px; line-height: 1.35; }
  .case-tag  {
      display: inline-block;
      font-size: 9px; font-weight: 700;
      padding: 1px 6px; border-radius: 10px;
      margin-top: 4px;
      text-transform: uppercase; letter-spacing: 0.5px;
  }
  .case-tag.High   { background: #FEE4E2; color: #B42318; }
  .case-tag.Medium { background: #FEF0C7; color: #B54708; }
  .case-tag.Low    { background: #EAECF0; color: #475467; }

  /* Tool trace badges */
  .tool-badge {
      display: inline-block;
      background: #EEF4FF;
      color: #2F58CD;
      font-size: 11px; font-weight: 600;
      padding: 3px 10px;
      border-radius: 20px;
      margin: 4px 4px 0 0;
      border: 1px solid #D1E0FF;
  }

  /* Chat input area */
  div[data-testid="stChatInput"] textarea {
      font-size: 15px;
      padding-right: 58px !important;   /* leave room for overlaid mic */
  }
  div[data-testid="stChatInput"] {
      border-radius: 14px !important;
  }

  /* Overlay the mic button INSIDE the chat input on the right edge */
  div.st-key-mic-footer {
      position: fixed;
      right: calc(2rem + 4px);
      bottom: 26px;
      z-index: 1001;
      width: auto;
      margin: 0 !important;
      padding: 0 !important;
      background: transparent !important;
      border: none !important;
      box-shadow: none !important;
  }
  div.st-key-mic-footer div[data-testid="stHorizontalBlock"],
  div.st-key-mic-footer div[data-testid="stColumn"] {
      padding: 0 !important;
      margin: 0 !important;
      gap: 0 !important;
  }
  div.st-key-mic-footer button {
      width: 40px !important;
      height: 40px !important;
      min-width: 40px !important;
      min-height: 40px !important;
      padding: 0 !important;
      border-radius: 50% !important;
      font-size: 18px !important;
      background: #2F58CD !important;
      color: white !important;
      border: none !important;
      box-shadow: 0 2px 8px rgba(47, 88, 205, 0.35);
      transition: transform 0.15s ease, background 0.2s ease;
  }
  div.st-key-mic-footer button:hover {
      transform: scale(1.08);
      background: #1E40AF !important;
  }
  div.st-key-mic-footer button:active {
      transform: scale(0.94);
  }

  /* Leave room so the last chat message isn't hidden behind the fixed chat_input */
  .block-container { padding-bottom: 140px !important; }

  @media (max-width: 900px) {
      div.st-key-mic-footer { right: 1.25rem; bottom: 22px; }
  }

  /* Sidebar section headers */
  .side-header {
      font-size: 11px; font-weight: 700;
      color: #667085; letter-spacing: 1.2px;
      text-transform: uppercase;
      margin: 14px 0 6px 0;
  }

  /* Assistant message polish */
  div[data-testid="chatAvatarIcon-assistant"] {
      background-color: #2F58CD !important;
  }
</style>
"""


# ──────────────────────────────────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────────────────────────────────
def _load_customers() -> dict:
    return json.loads(CUSTOMERS_FILE.read_text())


def _save_customers(customers: dict) -> None:
    CUSTOMERS_FILE.write_text(json.dumps(customers, indent=2))


def _next_customer_id(customers: dict) -> str:
    nums = [int(k[1:]) for k in customers if k.startswith("C") and k[1:].isdigit()]
    return f"C{max(nums + [9000]) + 1}"


def _initials(name: str) -> str:
    parts = [p for p in name.strip().split() if p]
    if not parts:
        return "?"
    if len(parts) == 1:
        return parts[0][:2].upper()
    return (parts[0][0] + parts[-1][0]).upper()


def _speak(text: str, rate: float = 1.0) -> None:
    """Browser SpeechSynthesis through the top window so a Streamlit rerun
    does not interrupt mid-sentence. Picks the best natural-sounding voice
    the OS exposes, preferring Google neural voices > Apple premium voices
    > regional en-IN/GB/US fallbacks."""
    safe = json.dumps(text)
    components.html(
        f"""
        <script>
        (function() {{
            const synth = (window.top || window).speechSynthesis;
            if (!synth) return;
            synth.cancel();

            const pickVoice = (voices) => {{
                // ranking (higher = better): Google neural > Microsoft neural >
                // Apple premium > regional en-* > any en
                const rank = (v) => {{
                    const name = (v.name || '').toLowerCase();
                    const lang = (v.lang || '').toLowerCase();
                    let score = 0;
                    if (name.includes('google')) score += 100;
                    if (name.includes('microsoft') && name.includes('neural')) score += 90;
                    if (name.includes('natural')) score += 80;
                    if (name.includes('samantha')) score += 70;
                    if (name.includes('daniel')) score += 65;
                    if (name.includes('karen')) score += 60;
                    if (name.includes('aaron') || name.includes('fred')) score += 55;
                    if (name.includes('rishi') || name.includes('veena')) score += 50;
                    if (lang.startsWith('en-in')) score += 20;
                    if (lang.startsWith('en-gb')) score += 15;
                    if (lang.startsWith('en-us')) score += 10;
                    if (lang.startsWith('en')) score += 5;
                    if (v.localService === false) score += 25; // cloud voices sound better
                    return score;
                }};
                return [...voices].sort((a, b) => rank(b) - rank(a))[0];
            }};

            const say = () => {{
                const utter = new SpeechSynthesisUtterance({safe});
                utter.rate = {rate}; utter.pitch = 1.0;
                const voices = synth.getVoices();
                const best = pickVoice(voices);
                if (best) {{
                    utter.voice = best;
                    utter.lang = best.lang;
                }} else {{
                    utter.lang = 'en-IN';
                }}
                synth.speak(utter);
            }};

            if (synth.getVoices().length === 0) {{
                synth.addEventListener('voiceschanged', say, {{ once: true }});
                // Safari/Chrome sometimes need a nudge
                setTimeout(() => {{ if (synth.getVoices().length) say(); }}, 250);
            }} else {{
                say();
            }}
        }})();
        </script>
        """,
        height=0,
    )


# ──────────────────────────────────────────────────────────────────────────
# UI
# ──────────────────────────────────────────────────────────────────────────
st.markdown(CSS, unsafe_allow_html=True)

# Top banner
st.markdown(
    """
    <div class="brand-banner">
        <div class="brand-logo">👓</div>
        <div>
            <div class="brand-title">LensAssist</div>
            <div class="brand-subtitle">Unified Post-Sales AI Concierge · Returns · Warranty · Lens · Orders · Membership</div>
        </div>
    </div>
    """,
    unsafe_allow_html=True,
)

# Metrics strip
st.markdown(
    """
    <div class="metrics-row">
        <div class="metric-card">
            <div class="metric-label">Avg Resolution TAT</div>
            <div class="metric-value">~2 min</div>
            <div class="metric-delta">↓ 99% vs 28 hr baseline</div>
        </div>
        <div class="metric-card success">
            <div class="metric-label">Tier-1 Auto-Resolution</div>
            <div class="metric-value">~70%</div>
            <div class="metric-delta">LLM + RAG + tool-use</div>
        </div>
        <div class="metric-card warning">
            <div class="metric-label">Est. Annual CX Savings</div>
            <div class="metric-value">₹1.2 Cr</div>
            <div class="metric-delta">Projected at full rollout</div>
        </div>
        <div class="metric-card accent">
            <div class="metric-label">Powered by</div>
            <div class="metric-value">Claude Sonnet 4.5</div>
            <div class="metric-delta">on AWS Bedrock</div>
        </div>
    </div>
    """,
    unsafe_allow_html=True,
)

customers = _load_customers()

# ──────────────────────────────────────────────────────────────────────────
# Sidebar
# ──────────────────────────────────────────────────────────────────────────
with st.sidebar:
    st.markdown('<div class="side-header">Active Customer</div>', unsafe_allow_html=True)

    customer_ids = list(customers.keys())
    default_idx = 0
    if "selected_cid" in st.session_state and st.session_state["selected_cid"] in customer_ids:
        default_idx = customer_ids.index(st.session_state["selected_cid"])
    cid = st.selectbox(
        "Customer",
        options=customer_ids,
        index=default_idx,
        format_func=lambda k: f"{k} · {customers[k]['name']}",
        label_visibility="collapsed",
    )
    st.session_state["selected_cid"] = cid
    c = customers[cid]

    gold_html = '<div class="gold-pill">⭐ GOLD MEMBER</div>' if c.get("gold_member") else ""
    st.markdown(
        f"""
        <div class="cust-card">
            <div><span class="cust-avatar">{_initials(c['name'])}</span>
            <span class="cust-name">{c['name']}</span></div>
            <div class="cust-meta">📍 {c['city']} · 📞 {c['phone']}</div>
            <div class="cust-meta">💰 LTV ₹{c['lifetime_value']:,}</div>
            {gold_html}
        </div>
        """,
        unsafe_allow_html=True,
    )

    with st.expander("➕ Add a new customer"):
        with st.form("new_customer", clear_on_submit=True):
            new_name = st.text_input("Name", placeholder="e.g., Ramneek Singh")
            new_phone = st.text_input("Phone", placeholder="+91-98xxxxxxxx")
            new_email = st.text_input("Email", placeholder="name@example.com")
            new_city = st.text_input("City", placeholder="Delhi")
            new_gold = st.checkbox("Gold Member", value=False)
            new_ltv = st.number_input("Lifetime value (₹)", min_value=0, value=0, step=500)
            col1, col2 = st.columns(2)
            with col1:
                new_right_sph = st.text_input("Right SPH", placeholder="-2.00")
            with col2:
                new_left_sph = st.text_input("Left SPH", placeholder="-2.25")
            submitted = st.form_submit_button("Create customer", use_container_width=True)
        if submitted:
            if not new_name.strip():
                st.error("Name is required.")
            else:
                new_id = _next_customer_id(customers)
                customers[new_id] = {
                    "customer_id": new_id,
                    "name": new_name.strip(),
                    "phone": new_phone.strip() or "N/A",
                    "email": new_email.strip() or "N/A",
                    "city": new_city.strip() or "N/A",
                    "gold_member": new_gold,
                    "lifetime_value": int(new_ltv),
                    "preferred_language": "English",
                    "last_rx": {
                        "right_sph": new_right_sph.strip() or "0.00",
                        "left_sph": new_left_sph.strip() or "0.00",
                        "date": date.today().isoformat(),
                    },
                }
                _save_customers(customers)
                st.session_state["selected_cid"] = new_id
                st.success(f"Created {new_id}")
                st.rerun()

    st.markdown('<div class="side-header">Open Salesforce Cases</div>', unsafe_allow_html=True)
    open_cases = [
        case for case in salesforce_mock.list_cases_for_customer(cid) if case["status"] == "Open"
    ]
    if not open_cases:
        st.caption("✅ No open cases for this customer")
    for case in open_cases:
        st.markdown(
            f"""
            <div class="case-card {case['priority']}">
                <div class="case-id">{case['case_id']}</div>
                <div class="case-subj">{case['subject']}</div>
                <div class="case-tag {case['priority']}">{case['priority']}</div>
            </div>
            """,
            unsafe_allow_html=True,
        )

    st.markdown('<div class="side-header">Voice</div>', unsafe_allow_html=True)
    st.toggle("🔊 Speak agent replies", value=True, key="voice_out")
    st.slider(
        "Speech rate",
        min_value=0.7, max_value=1.3, value=1.0, step=0.05,
        key="voice_rate",
        help="Lower = slower & clearer. Higher = faster.",
    )

    st.markdown('<div class="side-header">Session</div>', unsafe_allow_html=True)
    if st.button("🗑️ Reset this conversation", use_container_width=True):
        memory.reset(cid)
        st.session_state.pop(f"messages_{cid}", None)
        st.rerun()

# ──────────────────────────────────────────────────────────────────────────
# Chat area
# ──────────────────────────────────────────────────────────────────────────
msg_key = f"messages_{cid}"
if msg_key not in st.session_state:
    st.session_state[msg_key] = []
    existing = memory.load(cid).get("turns", [])
    for t in existing[-10:]:
        role = "user" if t["role"] == "customer" else "assistant"
        st.session_state[msg_key].append({"role": role, "content": t["text"]})

# Welcome card when conversation is empty
if not st.session_state[msg_key]:
    st.info(
        f"👋 You're chatting as **{c['name']}** "
        f"({'Gold member' if c.get('gold_member') else 'Standard customer'}, {c['city']}). "
        "Try: *'My blu-cut coating is peeling'*, *'Where is my order?'*, or tap the 🎙️ mic button."
    )

for m in st.session_state[msg_key]:
    with st.chat_message(m["role"]):
        st.markdown(m["content"])


def _handle_user_message(prompt: str) -> None:
    st.session_state[msg_key].append({"role": "user", "content": prompt})
    with st.chat_message("user"):
        st.markdown(prompt)
    with st.chat_message("assistant"):
        with st.spinner("LensAssist is reasoning…"):
            result = concierge.respond(cid, prompt)
        st.markdown(result["reply"])
        if result["trace"]:
            badges = "".join(
                f'<span class="tool-badge">🔧 {s["tool"]}</span>' for s in result["trace"]
            )
            st.markdown(badges, unsafe_allow_html=True)
            with st.expander(f"View agent reasoning · {len(result['trace'])} tool call(s)"):
                for i, step in enumerate(result["trace"], 1):
                    st.markdown(f"**Step {i} — `{step['tool']}`**")
                    st.json(step["input"])
                    st.code(step["output"], language="text")
    st.session_state[msg_key].append({"role": "assistant", "content": result["reply"]})
    if st.session_state.get("voice_out", True):
        st.session_state["pending_speech"] = result["reply"]


# ──────────────────────────────────────────────────────────────────────────
# Unified footer input: chat_input with mic icon overlaid inside on the right
# ──────────────────────────────────────────────────────────────────────────
typed = st.chat_input(f"Type or tap the mic to speak as {c['name']}…")

with st.container(key="mic-footer"):
    spoken = speech_to_text(
        language="en-IN",
        start_prompt="🎙",
        stop_prompt="⏹",
        just_once=True,
        use_container_width=False,
        key=f"stt_{cid}",
    )

prompt = spoken or typed
if prompt:
    _handle_user_message(prompt)
    st.rerun()

# Speak any pending reply on THIS run (after the message has been painted).
pending = st.session_state.pop("pending_speech", None)
if pending:
    rate = st.session_state.get("voice_rate", 1.0)
    _speak(pending, rate=rate)
