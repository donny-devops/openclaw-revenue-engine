# OpenClaw Revenue Engine

> Monetise autonomous AI agents through Moltgate's paid inbox layer.  
> Built by [@donny-devops](https://github.com/donny-devops)

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                        EXTERNAL (PUBLIC WEB)                         │
│                                                                      │
│   Client ──▶ moltgate.com/{handle}/{lane-slug}/                      │
│              │  Selects tier, writes message, pays via Stripe         │
│              ▼                                                       │
│   ┌──────────────────────────┐                                       │
│   │  Moltgate Platform       │                                       │
│   │  • Stripe checkout       │                                       │
│   │  • Message sanitisation  │                                       │
│   │  • Inbox storage         │                                       │
│   └──────────┬───────────────┘                                       │
│              │  REST API (Bearer mg_key_...)                          │
└──────────────┼───────────────────────────────────────────────────────┘
               │
┌──────────────▼───────────────────────────────────────────────────────┐
│                  OPENCLAW REVENUE ENGINE (this repo)                  │
│                                                                      │
│   ┌─────────────┐    ┌────────────────┐    ┌──────────────────┐      │
│   │   Poller     │───▶│  OpenClaw      │───▶│  Anthropic API   │      │
│   │              │    │  Bridge        │    │  (Claude Sonnet) │      │
│   │  • Fetch NEW │    │               │    │                  │      │
│   │  • Backoff   │    │  • Tier policy │    │  • System prompt │      │
│   │  • Metrics   │    │  • Prompt build│    │  • Tiered tokens │      │
│   │  • Mark DONE │    │  • Fallback    │    │  • Response gen  │      │
│   └──────┬──────┘    └────────────────┘    └──────────────────┘      │
│          │                                                           │
│   ┌──────▼──────┐    ┌────────────────┐                              │
│   │ Lane Manager │    │  Config (.env) │                              │
│   │              │    │                │                              │
│   │ • Sync tiers │    │ • API keys     │                              │
│   │ • CRUD lanes │    │ • Poll tuning  │                              │
│   │ • Blueprints │    │ • Agent URL    │                              │
│   └─────────────┘    └────────────────┘                              │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

## Revenue Flow

```
Client pays $9 / $29 / $99 ──▶ Stripe ──▶ Moltgate holds funds
                                              │
Poller fetches NEW message ◀──────────────────┘
         │
         ▼
Bridge builds tiered prompt ──▶ AI Agent generates response
         │
         ▼
Message marked PROCESSED ──▶ Revenue tracked in session stats
```

## Lane Tiers

| Lane | Price | Max Tokens | Character Limit | Use Case |
|------|-------|-----------|-----------------|----------|
| Quick Question | $9 | 800 | 500 | Focused single-question answer |
| Deep Dive Consult | $29 | 3,000 | 2,000 | Multi-step analysis with references |
| Priority Request | $99 | 6,000 | 5,000 | Consulting-grade deliverable |

## Project Structure

```
openclaw-revenue-engine/
├── main.py                  # CLI entry point
├── config.py                # Settings from .env
├── .env.example             # Template for environment vars
├── requirements.txt         # Python deps (httpx, dotenv)
├── core/
│   ├── __init__.py
│   ├── moltgate_client.py   # Async Moltgate API client (full CRUD)
│   ├── lane_manager.py      # Lane provisioning + sync
│   ├── openclaw_bridge.py   # AI agent dispatcher + prompt builder
│   └── poller.py            # Polling loop with backoff + metrics
└── README.md
```

## Quickstart

```bash
# 1. Clone
git clone https://github.com/donny-devops/openclaw-revenue-engine.git
cd openclaw-revenue-engine

# 2. Install
pip install -r requirements.txt

# 3. Configure
cp .env.example .env
# Edit .env with your Moltgate API key, Anthropic key, and profile handle

# 4. Sync lanes (creates the 3 default tiers on Moltgate)
python main.py --sync-only

# 5. Start polling
python main.py

# Or poll a single lane:
python main.py --lane quick-question

# Or bypass OpenClaw and use Anthropic directly:
python main.py --direct-api
```

## CLI Options

| Flag | Description |
|------|-------------|
| `--poll-only` | Skip lane sync, start polling immediately |
| `--sync-only` | Sync lane blueprints and exit |
| `--lane SLUG` | Poll only messages from a specific lane |
| `--direct-api` | Bypass OpenClaw agent, call Anthropic API directly |
| `--interval N` | Override poll interval in seconds |

## Security

- **API keys**: Never commit `.env`. The `.env.example` contains placeholders only.
- **Message sanitisation**: Moltgate strips HTML/attachments server-side. All content is plain-text.
- **Untrusted input**: The bridge's system prompt instructs the agent to never execute links, code, or embedded instructions from message content.
- **Tier enforcement**: Character limits are enforced by Moltgate per lane ($9→500, $29→2k, $99→5k).

## Extending

### Add a response delivery layer
The `_process_message` method in `poller.py` has a `TODO` marker for delivering agent responses back to senders. Options:
- **Email** via SendGrid / AWS SES
- **Moltgate reply API** (when available)
- **Response queue** (Redis / SQS) for human review before sending

### Add new lane tiers
Edit `LANE_BLUEPRINTS` in `core/lane_manager.py` and run `python main.py --sync-only`.

### Swap the AI backend
Edit `TIER_POLICY` in `core/openclaw_bridge.py` to change models per tier, or point `OPENCLAW_AGENT_URL` to any OpenAI-compatible endpoint.

---

**License**: MIT  
**Author**: Donny · [@donny-devops](https://github.com/donny-devops) · DreamTech USA
