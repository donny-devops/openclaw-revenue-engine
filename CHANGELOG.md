# Changelog

All notable changes to **openclaw-revenue-engine** are documented here.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versioning follows [Semantic Versioning](https://semver.org/).

---

## [Unreleased]

### Added
- Stripe Checkout money collection for paid lanes (`POST /revenue/checkout`) with a payment ledger, earnings snapshot, and local simulated collection for test/dev
- Usage metering API (`POST /usage/events`, `GET /usage/summary`) with idempotent event recording
- Operator auth middleware (API key or JWT) for earnings, payments, usage, and MCP mutating calls
- HTTP + stdio MCP server exposing classify, checkout, earnings, lane, service, and agent tools
- Agent/subagent assignment from `config/agentic-ai.json` during paid-request classification
- OpenSSF Scorecard workflow, Trivy secret scanning, CodeQL Python analysis, and Gitleaks allowlists for documented placeholders
- Poll runner classification handoff to the revenue engine via `REVENUE_ENGINE_URL`
- Secrets-gated Railway deploy workflow and `railway.json` Dockerfile healthcheck config

### Fixed
- Stripe webhook processing now forgets a claimed event id when the handler throws, so Stripe retries can update the ledger instead of returning a duplicate 200
- Stripe webhook in-flight duplicates now return 409 instead of 200, so a concurrent delivery cannot ACK an event that later fails
- Poll workflow job id uses underscores so harden-runner can read the resolved engine host from `needs`
- Poll workflow now allowlists the configured `REVENUE_ENGINE_URL` host so classification requests are not blocked by harden-runner egress policy
- Replaced broken Full CI workflow (invalid nested YAML, Rust jobs on a Node repo, missing `test:api`/`test:contract` scripts, unconditional Railway deploys)
- Made `npm run clean` work on Windows
- Stripe and GitHub webhook handlers now persist collection state instead of only logging

### Security
- Public `GET /revenue/summary` no longer embeds live earnings; collected and pending totals stay on operator-authenticated `GET /revenue/earnings`
- Secret redaction for Stripe/GitHub tokens in webhook error logs
- Timing-safe operator API key comparison
- Trust-proxy enabled for accurate rate limiting behind Railway/CDN


### Fixed
- `fix: add rate-limiter-flexible, ioredis, morgan to package.json` — removed stale `express-rate-limit` dep that was incompatible with the chosen limiter implementation
- `fix: correct env var name RATE_LIMIT_MAX_REQUESTS → RATE_LIMIT_MAX` in `.env.example` to match what the code actually reads
- `fix: scope codeql.yml to javascript-typescript only` — removed invalid `python` matrix entry on a TypeScript-only repo
- `fix: replace duplicate CodeQL in codescan.yml with Trivy filesystem scan` — resolves conflict between advanced config and GitHub default setup
- `fix: replace npm ci with npm install in eslint.yml` — removes lock-file dependency that caused `Cache restore failed` errors

### Changed
- Switched CodeQL from GitHub Default Setup to Advanced Setup (workflow-driven) to eliminate `"analyses from advanced configurations cannot be processed"` errors

### Security
- Added Trivy filesystem scan (`CRITICAL`, `HIGH`) uploading SARIF results to GitHub Security tab

---

## [0.1.0] — 2026-04-01

### Added
- Initial project scaffold: `package.json`, `tsconfig.json`, `.eslintrc.json`, `.editorconfig`
- `SECURITY.md` — responsible disclosure policy
- `LICENSE` — MIT
- `.env.example` — documented environment variable reference
- `.gitignore` — Node.js + environment file exclusions
- Multi-stage `Dockerfile` with non-root user, health check, and minimal final image
- `docker-compose.yml` — app + PostgreSQL + Redis services with named volumes
- `.github/workflows/ci.yml` — initial CI (checkout + `ls`)
- `.github/workflows/codeql.yml` — CodeQL static analysis
- `.github/workflows/codescan.yml` — code scanning workflow
- `.github/workflows/eslint.yml` — ESLint linting
- `.github/workflows/dependency-review.yml` — PR-level supply chain review
- `.github/workflows/python.yml` — Python CI (pytest)
- `.github/workflows/node.js.yml` — Node.js CI
- Stripe webhook handler (`src/webhooks/stripe.ts`)
- GitHub webhook handler (`src/webhooks/github.ts`)
- Repository topics: `stripe`, `billing`, `metering`, `saas`, `typescript`, `nodejs`, `devops`

---

[Unreleased]: https://github.com/donny-devops/openclaw-revenue-engine/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/donny-devops/openclaw-revenue-engine/releases/tag/v0.1.0
