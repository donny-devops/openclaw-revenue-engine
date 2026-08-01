# AGENTS.md — OpenClaw Revenue Engine

> Guidance for AI coding agents (Copilot, Codex, Claude, etc.) working in this repository.

---

## What This Project Does

**openclaw-revenue-engine** is a Node.js / TypeScript HTTP server that bridges the [OpenClaw](https://github.com/openclaw/openclaw) agentic-AI platform with Stripe-backed paid inbound messaging via [Moltgate](https://moltgate.com). It:

- Classifies inbound paid requests into **lanes** (Small Request / Detailed Request / Real Offer) and **services** (security review, code review, DevOps consulting, etc.)
- Exposes a REST API consumed by the OpenClaw agent and by operators
- Handles Stripe and GitHub webhooks with HMAC signature verification
- Manages rate limiting (global + per-webhook) and structured JSON logging via Winston

---

## Repository Layout

```
openclaw-revenue-engine/
├── src/
│   ├── index.ts               # Express app factory (middleware, routes, error handler)
│   ├── server.ts              # HTTP server entry point (listen, SIGTERM)
│   ├── routes/
│   │   └── revenue.ts         # /revenue/* route handlers (classify, lanes, services, summary)
│   ├── revenue/
│   │   ├── config.ts          # JSON config loaders (lanes, services, openclaw, templates)
│   │   ├── serviceCatalog.ts  # Core classification logic — inferService, inferLane, classifyPaidRequest
│   │   └── types.ts           # TypeScript interfaces for all domain objects
│   ├── models/
│   │   └── index.ts           # Shared model/schema definitions
│   └── webhooks/
│       ├── stripe.webhook.ts  # Stripe event handler (signature verification, event routing)
│       └── github.webhook.ts  # GitHub webhook handler (signature verification)
├── config/
│   ├── lanes.json             # Lane catalog: slugs, prices, SLA, capabilities, max_input_chars
│   ├── services.json          # Service catalog: slugs, keywords, recommended_lane, templates
│   ├── openclaw.json          # Engine config: defaults, routing labels, guardrails, delivery
│   ├── agentic-ai.json        # Agentic AI agent registry (orchestrator, SWE, compliance agents)
│   └── mcp-gateway.json       # MCP server gateway configuration
├── tests/
│   ├── unit/                  # Unit tests (revenue routes, service logic, webhooks, models)
│   ├── integration/           # Integration tests
│   ├── performance/           # Performance/load tests
│   └── helpers/               # Shared test utilities
├── services/                  # Markdown service-delivery templates (ai-roadmap, hardening, etc.)
├── docs/                      # Additional documentation
├── workflows/                 # Agentic workflow definitions
├── .env.example               # Template for required environment variables
├── jest.config.js             # Jest configuration (ts-jest, path aliases)
├── tsconfig.json              # TypeScript compiler settings
├── .eslintrc.json             # ESLint rules (TypeScript-aware)
└── Dockerfile                 # Container image definition
```

---

## Development Setup

```bash
# Install dependencies
npm install

# Copy environment template and fill in values
cp .env.example .env
# Edit .env — do NOT commit the filled-in file

# Run in development mode (ts-node, no build step)
npm run dev
```

**Required environment variables** (see `.env.example` for the full list):

| Variable | Purpose |
|---|---|
| `STRIPE_SECRET_KEY` | Stripe API key (sk_test_… or sk_live_…) |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret (whsec_…) |
| `GITHUB_WEBHOOK_SECRET` | GitHub webhook HMAC secret |
| `JWT_SECRET` | JWT signing secret (long random string) |
| `DATABASE_URL` | PostgreSQL connection string |
| `PORT` | HTTP listen port (default `3000`) |

---

## Build, Lint, and Test Commands

```bash
# Type-check without emitting (fast feedback)
npm run type-check

# Lint TypeScript source
npm run lint

# Run all tests
npm test

# Run only unit tests
npm run test:unit

# Run only integration tests
npm run test:integration

# Run with coverage report
npm run test:coverage

# Compile TypeScript to dist/
npm run build

# Start the compiled server
npm start
```

Always run `npm run type-check` and `npm run lint` after making TypeScript changes. Run `npm test` before committing.

---

## Architecture and Key Patterns

### Request Classification Flow

```
POST /revenue/classify
  → Zod schema validation (paidRequestSchema)
  → classifyPaidRequest() in src/revenue/serviceCatalog.ts
      → inferService()  — keyword scoring against services.json
      → inferLane()     — recommended_lane from service, or explicit override
      → validate max_input_chars
      → build labels from openclaw.json routing config
  → returns ClassifiedPaidRequest (lane, service, price, labels, template)
```

### Config Loading

All JSON configs are loaded from `config/` at request time (not cached globally). The loaders live in `src/revenue/config.ts`. To add a new lane or service, edit the appropriate JSON file — no TypeScript changes needed unless you add new fields to the interfaces in `src/revenue/types.ts`.

### Webhook Security

Both `stripe.webhook.ts` and `github.webhook.ts` **must** be registered with `express.raw({ type: 'application/json' })` **before** the global `express.json()` middleware. This ordering is enforced in `src/index.ts`. Never move these routes below the `app.use(express.json())` line — doing so breaks HMAC verification.

Stripe uses `stripe.webhooks.constructEvent()` (synchronous). GitHub uses HMAC-SHA256 over the raw body. Both handlers reject requests with missing or invalid signatures before any other processing.

### Rate Limiting

- **Global limiter**: 100 requests / 60 s, applied to all routes except webhook routes
- **Webhook limiter**: 30 requests / 60 s, applied only to `/webhooks/*`

Both use `express-rate-limit`. If you add new routes, ensure they fall under the appropriate limiter.

### Logging

The app uses Winston with JSON-format structured logging. The logger instance is exported from `src/index.ts`:

```typescript
import { logger } from './index';
logger.info('message', { key: 'value' });
```

Do not use `console.log` in new production code paths — use the Winston logger so logs stay structured and filterable.

---

## Coding Conventions

- **TypeScript** with strict mode — all new code must pass `npm run type-check`
- **Zod** for runtime validation of all external inputs (request bodies, webhook payloads)
- **Named exports** are preferred over default exports (except `app` and `server`)
- **No `any`** — use proper interfaces from `src/revenue/types.ts` or define new ones
- Functions operating on revenue/pricing logic must use exact integer arithmetic (prices are in whole currency units, e.g. `19` = $19 USD); do not introduce floating-point arithmetic
- All new route handlers must validate input with Zod before any business logic
- All new webhook handlers must verify signatures before processing

---

## Adding a New Lane or Service

**New lane** — edit `config/lanes.json`:
- Add an entry with `slug`, `name`, `price`, `sla_hours`, `capabilities`, `deliverables`, `max_input_chars`, `human_review_required`, `enabled`
- The slug is used as the routing key — keep it lowercase-hyphenated

**New service** — edit `config/services.json`:
- Add an entry with `slug`, `name`, `description`, `recommended_lane` (must match an existing lane slug), `keywords` (used for scoring), `deliverable_template`, `outputs`, `enabled`

**New deliverable template** — add a file under `services/` and reference it in the service's `deliverable_template` field.

No TypeScript changes are needed unless the new config fields require new interface fields in `src/revenue/types.ts`.

---

## Adding a New API Route

1. Add the handler to `src/routes/revenue.ts` (or create a new router file and mount it in `src/index.ts`)
2. Validate the request body with a Zod schema before calling any business logic
3. Return structured JSON; use appropriate HTTP status codes
4. Add unit tests in `tests/unit/revenue.routes.test.ts` (or a new file)

---

## Security Rules — Do Not Violate

- **Never** hardcode API keys, secrets, or tokens in source code or config files; all secrets come from environment variables
- **Never** log request bodies, customer emails, or any PII through the Winston logger or `console.*`
- **Never** bypass Stripe or GitHub webhook signature verification — even in tests, use the test-helper utilities that generate valid signatures
- **Never** pass unvalidated user input directly into database queries, shell commands, or LLM prompts
- **Never** disable or weaken the rate limiters without an explicit product decision documented in the PR
- Stripe webhook events must be processed idempotently — check for existing records before creating new ones
- All pricing changes must produce an audit log entry (log the event with Winston at `info` level including `event_type`, `amount`, `currency`, `customer_id`)

---

## Testing Guidelines

- Unit tests live in `tests/unit/` and must not make real network calls — mock Stripe, GitHub, and database clients
- Integration tests in `tests/integration/` may use a real test database but must not call external APIs
- Use `supertest` to test Express routes without starting a real server
- When testing webhook handlers, generate valid HMAC signatures using the test helpers in `tests/helpers/`
- Minimum expectation: every new route and every modified classification function must have corresponding unit tests

---

## What Agents Should Avoid

- Do not change `config/lanes.json` or `config/services.json` pricing values without an explicit instruction — pricing is a business decision
- Do not remove or relax type assertions, Zod validations, or signature checks without a clear security justification
- Do not introduce new `npm` dependencies without checking for known vulnerabilities and confirming they are necessary
- Do not alter the middleware ordering in `src/index.ts` (raw body parsing for webhooks must come before `express.json()`)
- Do not generate or commit `.env` files with real secrets
- Do not refactor working code speculatively — make the smallest correct change that satisfies the task
