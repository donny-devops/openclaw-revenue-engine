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

### Implemented today

- **Stripe Webhook Handler** - Verifies Stripe HMAC signatures and routes subscription/invoice/checkout events to typed handler functions
- **GitHub Webhook Handler** - Verifies GitHub HMAC-SHA256 signatures and routes push, pull_request, release, workflow_run, and repository_dispatch events
- **Typed Domain Models** - Pure-TypeScript interfaces and enums for tenants, usage records, invoices, subscriptions, and API shapes — no runtime framework required
- **Security Middleware** - Helmet, CORS, and tiered rate limiting (100 req/min global, 30 req/min on webhook routes) applied at the Express layer
- **Structured Logging** - Winston-based JSON logging with configurable level and timestamp
- **Test Suite** - Unit, integration, and performance tests via Jest + Supertest with enforced coverage thresholds (80% lines/functions/statements, 70% branches)
- **CI/CD Pipeline** - GitHub Actions workflows for lint, type-check, test, build, CodeQL analysis, dependency review, and secret scanning (TruffleHog)
- **Docker Support** - Multi-stage Dockerfile producing a minimal, non-root production image

### Planned (in development)

- **Moltgate Lane Integration** - Polling for paid inbox messages across Ping, Standard, Priority, Ultra, and Micro tiers
- **Autonomous Fetching** - Configurable-interval agent polling via the Moltgate API
- **Intent-Based Routing** - Triage by lane tier, message content, and keyword signals
- **Multi-Model Support** - Anthropic Claude, OpenAI GPT, Google Gemini, or any OpenClaw-compatible model
- **Service Catalog** - Pre-configured templates for consulting, security reviews, and AI roadmap services
- **Crypto-Agile Security** - Modular encryption layer for post-quantum readiness (ML-KEM, ML-DSA / NIST FIPS 203/204/205)
 
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

The codebase is currently focused on webhook handling, typed domain models, and CI/test scaffolding. The agent/engine/lanes/services layers described in the vision above are in active development.

```
openclaw-revenue-engine/
├── src/
│   ├── index.ts            # Express app — middleware, routes, server startup
│   ├── models/
│   │   └── index.ts        # Domain models — Tenant, Invoice, Subscription, UsageRecord, enums
│   └── webhooks/
│       ├── stripe.webhook.ts   # Stripe signature verification + event routing
│       └── github.webhook.ts   # GitHub HMAC verification + event routing
├── tests/
│   ├── unit/               # Webhook handler and model unit tests (Jest)
│   ├── integration/        # HTTP-level app tests (Supertest)
│   ├── performance/        # Load / perf-oriented tests
│   └── helpers/            # Shared fixtures, mock factories, globalSetup
├── .github/workflows/      # CI, test, CodeQL, dependency review, secret scanning
├── Dockerfile              # Multi-stage build → minimal non-root production image
├── .env.example            # Template environment variables
├── .gitignore
├── package.json
└── README.md
```
 
---
 
## Moltgate Lanes _(planned)_

The following lane tiers are the target integration points once polling and routing are implemented:

| Lane | Use Case | Typical Price | SLA |
|------|----------|--------------|-----|
| **Micro** | Small tasks, agent handshaking | $1–$3 | Best-effort |
| **Ping** | Basic outreach, spam filtering | $3–$5 | 24 hours |
| **Standard** | Consulting asks, support escalations | $10–$25 | 12 hours |
| **Priority** | High-urgency business requests | $25–$75 | 4 hours |
| **Ultra** | Premium agent workflows, heavy runtime | $75–$200+ | 1 hour |

Lane pricing, response windows, and routing logic will be configurable once `src/lanes/` and `config/lanes.json` are introduced.
 
---
 
## Service Examples _(planned)_

Once `src/services/` and lane routing are in place, the revenue engine will ship with templates for common monetized agent services:

- **OpenClaw Security Review** ($10) - One focused security question answered by your agent
- **OpenClaw Hardening Audit** ($30) - Full security posture review for OpenClaw builders
- **Ailephant AI Roadmap** - Practical AI workflow roadmaps for founders and teams
- **DevOps Consulting** - Infrastructure reviews, CI/CD pipeline analysis, cloud architecture guidance
- **Code Review** - Automated code quality and security analysis with detailed feedback

Build your own services by adding handlers to `src/services/` and registering them in the lane routing config.
 
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

- [x] Express app with security middleware (Helmet, CORS, rate limiting)
- [x] Stripe webhook handler with signature verification
- [x] GitHub webhook handler with HMAC-SHA256 verification
- [x] Typed domain models (Tenant, Invoice, Subscription, UsageRecord)
- [x] Jest test suite — unit, integration, performance — with coverage thresholds
- [x] Multi-stage Docker build with non-root runner
- [x] GitHub Actions CI — lint, type-check, test, build, CodeQL, dependency review, secret scanning
- [ ] Core Moltgate API integration (polling paid inbox)
- [ ] Lane-based request routing (Ping, Standard, Priority, Ultra, Micro)
- [ ] Multi-model AI support (Claude, GPT, Gemini)
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
