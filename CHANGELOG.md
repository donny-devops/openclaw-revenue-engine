# Changelog

All notable changes to **openclaw-revenue-engine** are documented here.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versioning follows [Semantic Versioning](https://semver.org/).

---

## [Unreleased]

### Added
- `feat: add global rate limiter middleware` — Redis sliding-window with in-memory fallback, `X-RateLimit-*` headers, `429` responses, allow-list bypass via `RATE_LIMIT_SKIP_IPS` ([#1](https://github.com/donny-devops/openclaw-revenue-engine/pull/1))
- `feat: wire globalRateLimiter into src/index.ts` — mounted before all routes; added morgan request logging, dotenv config, graceful SIGTERM/SIGINT shutdown, and `trust proxy` for production
- `test: unit tests for rateLimiter middleware` — covers allowed requests, 429 limit exceeded, allow-list bypass, `X-Forwarded-For` IP resolution
- `feat: add src/models/index.ts` — full TypeScript domain models: `Tenant`, `UsageRecord`, `Invoice`, `Subscription`, `EarningsSummary`, Stripe webhook payload types
- `feat: add src/index.ts` — Express app entry point with health check, 404 handler, global error handler

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
