from __future__ import annotations

import json
from pathlib import Path

import streamlit as st

from agents.orchestrator import plan_request

REPO_ROOT = Path(__file__).resolve().parents[1]

st.set_page_config(page_title="OpenClaw Revenue Engine", layout="wide")
st.title("OpenClaw Revenue Engine Operator Console")
st.caption("Moltgate lane routing, agent planning, and human-reviewed delivery workflow.")

request_text = st.text_area(
    "Customer request",
    "Debug my GitHub Actions workflow and create a paid Moltgate delivery summary.",
    height=160,
)

if st.button("Plan agent workflow"):
    tasks = plan_request(request_text)
    st.subheader("Agent task plan")
    st.json([task.__dict__ for task in tasks])

with st.expander("Agent registry"):
    registry_path = REPO_ROOT / "config" / "agentic-ai.json"
    st.json(json.loads(registry_path.read_text(encoding="utf-8")))

with st.expander("Platform matrix"):
    platforms_path = REPO_ROOT / "config" / "platforms.json"
    st.json(json.loads(platforms_path.read_text(encoding="utf-8")))
