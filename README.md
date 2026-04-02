# openclaw-revenue-engine
![CI](https://github.com/donny-devops/openclaw-revenue-engine/actions/workflows/ci.yml/badge.svg)
![CodeQL](https://github.com/donny-devops/openclaw-revenue-engine/actions/workflows/codeql.yml/badge.svg)
![ESLint](https://github.com/donny-devops/openclaw-revenue-engine/actions/workflows/eslint.yml/badge.svg)
![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)

Self-hosted revenue engine scaffold for OpenClaw agents - focused on webhook ingestion, secure middleware, and the platform foundations for usage metering and Stripe-backed billing.

---

## Status

This repository is currently an early-stage backend foundation, not a finished revenue platform.

Implemented today:
- Express + TypeScript service bootstrap
- Health and root API endpoints
- Structured logging with Winston
- Security middleware with Helmet, CORS, and rate limiting
- Raw-body webhook endpoints for Stripe and GitHub
- CI/security workflow scaffolding with GitHub Actions, ESLint, CodeQL, and dependency review
- Docker-ready project structure and environment template

In progress / planned:
- Usage metering domain services
- Stripe billing workflows beyond webhook intake
- Invoice generation
- Earnings reporting and dashboards
- Auth middleware
- OpenAPI / Swagger documentation

---

## What It Does

`openclaw-revenue-engine` is a self-hosted backend scaffold for building revenue operations around managed OpenClaw agent instances. The current codebase focuses on the service foundation: secure request handling, webhook intake, environment-based configuration, and CI/security controls.

The goal of the project is to evolve this scaffold into a complete revenue platform that supports:
- usage metering tied to agent activity,
- Stripe-based billing and subscription events,
- invoice generation,
- operator earnings visibility,
- and client-facing billing workflows.

---

## Why It Matters

Managed AI agent deployments need billing infrastructure that is reliable, auditable, and self-hosted. This repository is being built to support that model incrementally, starting with API and webhook foundations before expanding into full metering, billing, and reporting workflows.

---

## Architecture

### Current implementation

```text
[GitHub Webhooks] ----\
                       \
[Stripe Webhooks] -----> [Express API Service]
                          |-- rate limiting
                          |-- helmet / cors
                          |-- structured logging
                          |-- health endpoint
                          \-- webhook verification
```

### Target architecture

```text
[OpenClaw Agents]
        |
        v
[Usage Metering Service]
        |
        v
[Revenue Engine API] <----> [Stripe Billing]
        |
        +----> [Invoice Generator] ----> [Client Billing Views]
        |
        \----> [Earnings Reporting] ----> [Operator Dashboard]
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js / TypeScript |
| API | Express |
| Logging | Winston |
| Billing Integration | Stripe webhooks |
| Webhook Integration | GitHub webhooks |
| Containerization | Docker |
| CI/CD | GitHub Actions |
| Code Quality | ESLint |
| Security Scanning | CodeQL, Dependency Review |
| License | MIT |