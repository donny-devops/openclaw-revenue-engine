Readme · MD
Copy

# 🦞💰 OpenClaw Revenue Engine
 
**Monetize autonomous AI agents through Moltgate's paid inbox layer.**
 
> Turn your self-hosted OpenClaw agent into a revenue-generating machine - accept paid consulting requests, triage inbound by intent, and deliver AI-powered support services through priced message lanes.
 
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-24+-339933?logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![OpenClaw](https://img.shields.io/badge/OpenClaw-Compatible-FF6B6B?logo=lobster&logoColor=white)](https://github.com/openclaw/openclaw)
[![Moltgate](https://img.shields.io/badge/Moltgate-Integrated-7C3AED)](https://moltgate.com)
 
---
 
## What Is This?
 
The **OpenClaw Revenue Engine** bridges [OpenClaw](https://github.com/openclaw/openclaw) — the open-source personal AI assistant platform — with [Moltgate](https://moltgate.com)'s paid inbound messaging layer. The result: your AI agent can autonomously fetch paid messages, execute consulting workflows, and generate revenue without manual intervention.
 
**The pitch is simple:** Spam is free. Your agent's attention isn't.
 
### How It Works
 
```
[Client] → Pays via Moltgate Lane → [Paid Inbox] → [OpenClaw Agent Fetches via API] → [Agent Executes Task] → [Delivers Response]
```
 
1. Clients send paid messages through tiered Moltgate lanes
2. Your OpenClaw agent polls the Moltgate API for new paid requests
3. The engine triages requests by lane tier and routes to the appropriate workflow
4. The agent processes the task (consulting, code review, security audit, etc.)
5. Response is delivered back through the platform
 
---
 
## Features
 
- **Moltgate Lane Integration** - Supports all Moltgate tiers: Ping, Standard, Priority, Ultra, and Micro lanes, each with configurable pricing and SLA promises
- **Autonomous Fetching** - Agent polls for paid messages via the Moltgate API on a configurable interval - no manual inbox checking
- **Intent-Based Routing** - Incoming requests are triaged by lane tier, message content, and keyword signals to route to the right workflow
- **Multi-Model Support** - Works with Anthropic Claude (default), OpenAI GPT, Google Gemini, or any model supported by OpenClaw's model-agnostic gateway
- **Stripe-Backed Payments** - All payments handled through Moltgate's Stripe integration - card data never touches your infrastructure
- **Service Catalog Ready** - Pre-configured for consulting services like OpenClaw security reviews, hardening audits, and AI workflow roadmaps (Ailephant)
- **Crypto-Agile Security** - Designed with modular encryption for PQC readiness - a differentiator for FinTech buyers evaluating your services
 
---
 
## Quick Start
 
### Prerequisites
 
- **Node.js** 24+ (recommended) or 22.16+
- **OpenClaw** installed globally (`npm install -g openclaw@latest`)
- **Moltgate account** with at least one lane configured at [moltgate.com](https://moltgate.com)
- **API key** from your LLM provider (Anthropic, OpenAI, etc.)
 
### Installation
 
```bash
# Clone the repo
git clone https://github.com/donny-devops/openclaw-revenue-engine.git
cd openclaw-revenue-engine
 
# Install dependencies
npm install
 
# Run onboarding
openclaw onboard --install-daemon
```
 
### Configuration
 
Create a `.env` file in the project root:
 
```env
# AI Model Configuration
ANTHROPIC_API_KEY=sk-ant-your-key-here
AI_MODEL=claude-sonnet-4-20250514
 
# Gateway Configuration
GATEWAY_PORT=18789
GATEWAY_HOST=127.0.0.1
 
# Agent Identity
AGENT_NAME=YourAgentName
 
# Moltgate Integration
MOLTGATE_API_KEY=your-moltgate-api-key
MOLTGATE_POLL_INTERVAL=30000
 
# Stripe (handled via Moltgate - no direct keys needed)
```
 
> ⚠️ **Never commit your `.env` file.** Make sure `.env` is in your `.gitignore`. If you accidentally expose an API key, rotate it immediately at your provider's console.
 
### Run
 
```bash
# Start the gateway
openclaw gateway --port 18789 --verbose
 
# In a separate terminal, start the revenue engine
npm start
```
 
---
 
## Project Structure
 
```
openclaw-revenue-engine/
├── src/
│   ├── agent/          # OpenClaw agent configuration and skills
│   ├── engine/         # Core revenue engine — polling, triage, routing
│   ├── lanes/          # TypeScript lane stubs (Stripe/webhook-based)
│   ├── services/       # Service catalog definitions and execution logic
│   └── utils/          # Helpers — logging, rate limiting, error handling
├── config/
│   └── lanes.yaml      # Lane slug → handler routing map
├── lanes/              # Python lane handlers (Moltgate polling)
├── services/           # Python service modules (readme_generator, moltgate_client)
├── .env.example        # Template environment variables
├── .gitignore
├── main.py             # Python polling entry point (cron via poll.yml)
├── requirements.txt    # Python dependencies
├── package.json
└── README.md
```
 
---
 
## Moltgate Lanes
 
| Lane | Use Case | Typical Price | SLA |
|------|----------|--------------|-----|
| **Micro** | Small tasks, agent handshaking | $1–$3 | Best-effort |
| **Ping** | Basic outreach, spam filtering | $3–$5 | 24 hours |
| **Standard** | Consulting asks, support escalations | $10–$25 | 12 hours |
| **Priority** | High-urgency business requests | $25–$75 | 4 hours |
| **Ultra** | Premium agent workflows, heavy runtime | $75–$200+ | 1 hour |
 
Lanes are fully configurable in `config/lanes.yaml`. Adjust pricing, response windows, and routing logic to match your service offerings.
 
---
 
## Service Examples
 
The revenue engine ships with templates for common monetized agent services:

- **Quick Question | AI README Generator** ($5, 20 min SLA) - Send a GitHub repo URL and get a portfolio-quality `README.md` back. Covers project overview, installation, usage, tech stack, badges, folder structure, and contributing section — all auto-generated from your actual codebase by MaxClaw. See `lanes/quick_question.py` and `services/readme_generator/`.
- **OpenClaw Security Review** ($10) - One focused security question answered by your agent
- **OpenClaw Hardening Audit** ($30) - Full security posture review for OpenClaw builders
- **Ailephant AI Roadmap** - Practical AI workflow roadmaps for founders and teams
- **DevOps Consulting** - Infrastructure reviews, CI/CD pipeline analysis, cloud architecture guidance
- **Code Review** - Automated code quality and security analysis with detailed feedback

Build your own services by adding a handler module under `lanes/` and registering its slug in `config/lanes.yaml`. Handlers are pure Python and run once per poll cycle of `.github/workflows/poll.yml`.
 
---
 
## Security
 
This project follows a security-first approach:
 
- **No raw card data** - All payments delegated to Stripe via Moltgate
- **API key scoping** - Keys are scoped per-agent and per-lane with least-privilege access
- **Webhook verification** - All Moltgate webhooks verified via Ed25519 signatures
- **Rate limiting** - Configurable per-tier rate limits to prevent abuse
- **Crypto-agile architecture** - Encryption layer is modular and swappable for post-quantum readiness (NIST FIPS 203/204/205, ML-KEM, ML-DSA compatible)
- **Environment isolation** - Secrets managed via `.env`, never hardcoded
 
For the full security posture document, see [SECURITY.md](SECURITY.md).
 
---
 
## Roadmap
 
- [x] Core Moltgate API integration
- [x] Lane-based request routing
- [x] Multi-model AI support
- [ ] Real-time earnings dashboard
- [ ] Client reputation scoring
- [ ] Automated follow-up workflows
- [ ] Multi-agent support (route to specialized agents per service)
- [ ] Analytics and conversion tracking
- [ ] ClawHub skill registry publication
 
---
 
## Tech Stack
 
| Component | Technology |
|-----------|-----------|
| Runtime | Node.js 24+ / TypeScript |
| AI Platform | OpenClaw (self-hosted gateway) |
| Payment Layer | Moltgate → Stripe |
| Default Model | Anthropic Claude Sonnet |
| Deployment | Local / VPS / Docker |
 
---
 
## Contributing
 
Contributions are welcome. Please read [CONTRIBUTING.md](CONTRIBUTING.md) before submitting a PR.
 
1. Fork the repo
2. Create a feature branch (`git checkout -b feature/my-feature`)
3. Commit your changes (`git commit -m 'Add my feature'`)
4. Push to the branch (`git push origin feature/my-feature`)
5. Open a Pull Request
 
---
 
## License
This project is licensed under the [MIT License](LICENSE).
 
---
