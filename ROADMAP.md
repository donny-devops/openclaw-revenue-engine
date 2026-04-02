# Roadmap

This document tracks the planned development milestones for `openclaw-revenue-engine`.

---

## Milestone 1 — Foundation (Completed)

**Goal:** Establish a production-ready service scaffold with security, CI, and webhook intake.

- [x] Express + TypeScript service bootstrap
- [x] Health and root API endpoints (`/health`, `/`)
- [x] Structured logging with Winston
- [x] Security middleware (Helmet, CORS, rate limiting, trust proxy)
- [x] Raw-body Stripe webhook handler with HMAC verification
- [x] Raw-body GitHub webhook handler with HMAC-SHA256 verification
- [x] Multi-stage Dockerfile with non-root user and health check
- [x] Graceful shutdown with SIGTERM/SIGINT handling
- [x] Environment variable fail-fast at startup
- [x] GitHub Actions CI (lint, type-check, test, build)
- [x] CodeQL security scanning
- [x] Trivy filesystem vulnerability scanning
- [x] ESLint with TypeScript strict rules
- [x] SECURITY.md, CHANGELOG.md, README.md

---

## Milestone 2 — Usage Metering (Next)

**Goal:** Implement the core domain service for tracking agent usage events.

- [ ] `UsageEvent` data model and schema
- [ ] Usage event ingestion API (`POST /usage/events`)
- [ ] PostgreSQL integration via connection pool
- [ ] Idempotent event recording (duplicate prevention)
- [ ] Usage aggregation queries (by agent, by period)
- [ ] Unit tests for metering service
- [ ] Integration tests for usage API

---

## Milestone 3 — Stripe Billing Integration

**Goal:** Connect usage data to Stripe billing workflows.

- [ ] Stripe customer creation and management
- [ ] Usage-based subscription metering via Stripe Meters API
- [ ] Subscription lifecycle event handlers (created, updated, cancelled)
- [ ] Payment succeeded/failed webhook processing
- [ ] Checkout session completion handling
- [ ] Stripe customer portal session generation

---

## Milestone 4 — Invoice Generation

**Goal:** Produce structured invoice records from billing events.

- [ ] `Invoice` data model
- [ ] Invoice generation from Stripe payment events
- [ ] Invoice line item breakdown (by usage event type)
- [ ] Invoice PDF generation (PDFKit or similar)
- [ ] Invoice storage and retrieval API
- [ ] Invoice email delivery

---

## Milestone 5 — Operator Dashboard

**Goal:** Give operators visibility into earnings and platform revenue.

- [ ] Earnings aggregation service
- [ ] Revenue dashboard API endpoints
- [ ] Operator summary reports (daily, weekly, monthly)
- [ ] Export to CSV
- [ ] OpenAPI / Swagger documentation for all endpoints

---

## Milestone 6 — Auth and Client-Facing Billing

**Goal:** Secure the API and expose billing workflows to clients.

- [ ] JWT authentication middleware
- [ ] Role-based access control (operator vs client)
- [ ] Client billing portal API
- [ ] Client invoice history endpoint
- [ ] Subscription self-service (upgrade, downgrade, cancel)

---

## Notes

- Milestones are subject to change as requirements evolve.
- Each milestone will be tracked via GitHub Issues and linked PRs.
- Security and test coverage requirements apply to all new features.
