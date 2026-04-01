# openclaw-revenue-engine

![CI](https://github.com/donny-devops/openclaw-revenue-engine/actions/workflows/ci.yml/badge.svg)
![CodeQL](https://github.com/donny-devops/openclaw-revenue-engine/actions/workflows/codeql.yml/badge.svg)
![ESLint](https://github.com/donny-devops/openclaw-revenue-engine/actions/workflows/eslint.yml/badge.svg)
![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)

Self-hosted revenue engine for OpenClaw agents — usage metering, Stripe billing, client invoicing, and earnings dashboards for managed instances.

---

## What It Does

`openclaw-revenue-engine` is a production-grade backend service that powers revenue operations for managed OpenClaw agent instances. It handles usage metering, Stripe-based billing automation, client invoice generation, and earnings reporting in a single self-hosted service.

---

## Why It Matters

Managed AI agent deployments require reliable, auditable billing infrastructure. This engine provides:

- Automated usage metering tied directly to agent activity.
- Stripe billing integration for subscription and usage-based pricing.
- Client-facing invoicing with itemized usage breakdowns.
- Operator earnings dashboards for visibility across managed instances.
- A self-hosted model so billing data never leaves your infrastructure.

---

## Architecture

```
[OpenClaw Agents]
       |
       v
[Usage Metering Service]
       |
       v
[Revenue Engine API] <---> [Stripe Billing]
       |
       v
[Invoice Generator] --> [Client Dashboard]
       |
       v
[Earnings Dashboard] --> [Operator View]
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js / TypeScript |
| API | Express |
| Database | PostgreSQL |
| Billing | Stripe API |
| Containerization | Docker / Docker Compose |
| CI/CD | GitHub Actions |
| Code Quality | ESLint |
| Security Scanning | CodeQL, Dependency Review |
| License | MIT |

---

## Getting Started

### Prerequisites

- Node.js 20+
- Docker and Docker Compose
- PostgreSQL (or use the Docker Compose stack)
- Stripe account and API keys

### Installation

```bash
git clone https://github.com/donny-devops/openclaw-revenue-engine.git
cd openclaw-revenue-engine
npm install
```

### Environment Variables

Copy the example env file and fill in your values:

```bash
cp .env.example .env
```

Key variables:

```env
NODE_ENV=development
PORT=3000
DATABASE_URL=postgresql://user:password@localhost:5432/revenue_engine
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
JWT_SECRET=your_jwt_secret
```

### Run Locally

```bash
# Start with Docker Compose (recommended)
docker compose up --build

# Or run directly
npm run dev
```

The API will be available at `http://localhost:3000`.

---

## Testing

### Run Tests

```bash
npm test
```

### Lint

```bash
npm run lint
```

### Type Check

```bash
npm run typecheck
```

---

## CI / Security Controls

This repository is hardened with the following automated controls:

| Control | File | Trigger |
|---|---|---|
| CI (build + test) | `.github/workflows/ci.yml` | Push / PR to main |
| ESLint | `.github/workflows/eslint.yml` | Push / PR to main |
| Dependency Review | `.github/workflows/dependency-review.yml` | PR to main |
| CodeQL Analysis | `.github/workflows/codeql.yml` | Push / PR / weekly |
| Code Scanning | `.github/workflows/codescan.yml` | Push / PR / weekly |

Security policy: see [SECURITY.md](./SECURITY.md).

Secrets must never be committed. Use environment variables or a secrets manager for all sensitive configuration.

---

## Roadmap

- [ ] Usage metering API endpoints
- [ ] Stripe webhook handler
- [ ] Invoice PDF generation
- [ ] Operator earnings dashboard
- [ ] Client billing portal
- [ ] Rate limiting and auth middleware
- [ ] OpenAPI / Swagger documentation

---

## Contributing

Pull requests are welcome. Please open an issue first to discuss significant changes. See [SECURITY.md](./SECURITY.md) for vulnerability reporting.

---

## License

[MIT](./LICENSE) — Donny DevOps, 2026.
