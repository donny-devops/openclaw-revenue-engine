# Contributing

Thank you for considering contributing to this project! This document outlines the process and guidelines.

## Quick Start

1. **Fork** the repository
2. **Clone** your fork: `git clone https://github.com/YOUR-USERNAME/openclaw-revenue-engine.git`
3. **Create a branch**: `git checkout -b feature/your-feature-name`
4. **Make your changes** and commit with clear messages
5. **Push** to your fork: `git push origin feature/your-feature-name`
6. **Open a Pull Request** with a clear description

## Development Setup

This repo is a **Node/Express API** (`src/index.ts` + `src/server.ts`, listen `PORT` default **3000**) plus an **optional Python poll runner** (`main.py`). Full CI uses **Node 22.x**.

It is **not** a Grafana/SQS stack and there is **no** `docker-compose.yml`. `.env.example` still lists `DATABASE_URL`, Redis, and `RATE_LIMIT_*`; those are unused under `src/`. The live limiter is hardcoded `express-rate-limit` (100/60s, webhook 30/60s). Ledger, usage, and SARA Plus orders are in-memory maps.

```bash
git clone https://github.com/donny-devops/openclaw-revenue-engine.git
cd openclaw-revenue-engine
cp .env.example .env
```

Set non-empty `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, and `GITHUB_WEBHOOK_SECRET` before starting the API. Import-time `requireEnv` in the Stripe/GitHub webhook modules throws if any of those are missing.

```bash
npm ci
npm run dev          # ts-node src/server.ts
curl -s http://localhost:3000/health
npm test
```

**Production Stripe fail-closed (H3):** if `NODE_ENV=production`, `src/billing/stripeClient.ts` throws at import unless `STRIPE_SECRET_KEY` starts with `sk_live_` or `rk_live_`. Do not expect simulated checkout in production. Operator auth (H4) returns 503 in production when both `OPERATOR_API_KEY` and `JWT_SECRET` are unset.

Optional poll runner (does not load `config/lanes.yaml`):

```bash
pip install -r requirements.txt
python main.py --once --direct-api --poll-only --dry-run
```

See [README.md](README.md) for the HTTP API, SARA Plus constraints, MCP tools, and webhook raw-body requirements.

## Coding Standards

- Follow the existing code style and conventions
- Write clear, descriptive commit messages
- Add tests for new features
- Update documentation as needed
- Ensure all tests pass before submitting

## Pull Request Guidelines

### Before Submitting

- [ ] Tests pass locally
- [ ] Code follows project style guidelines
- [ ] Documentation updated (if applicable)
- [ ] Commit messages are clear and descriptive
- [ ] Branch is up to date with `main`

### PR Description Should Include

- **What** changed and **why**
- **How** to test the changes
- **Related issues** (if any) - use `Fixes #123` or `Closes #456`
- **Breaking changes** (if any)

## Code Review Process

1. A maintainer will review your PR within 3-5 business days
2. Address any requested changes
3. Once approved, a maintainer will merge your PR

## Reporting Issues

- Use the issue templates when available
- Provide clear steps to reproduce
- Include relevant logs, screenshots, or error messages
- Specify your environment (OS, version, dependencies)

## Code of Conduct

This project follows the [Contributor Covenant Code of Conduct](CODE_OF_CONDUCT.md). By participating, you agree to uphold this code.

## Questions?

- Open an issue with the `question` label
- Check existing issues and pull requests first
- See [SUPPORT.md](SUPPORT.md) for additional help resources

## License

By contributing, you agree that your contributions will be licensed under the same license as the project (see [LICENSE](LICENSE)).

---

**Thank you for helping make this project better!** 🚀
