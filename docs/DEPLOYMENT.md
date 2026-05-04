# Deployment Guide

This document describes how to build, validate, publish, and deploy the
`openclaw-revenue-engine` service. The repo ships with two complementary
deployment surfaces:

1. **`scripts/deploy.sh`** — a portable bash script you can run locally or from
   any CI system.
2. **`.github/workflows/deploy.yml`** — a GitHub Actions workflow that wraps
   the script with manual dispatch, push-to-main triggers, validation gates,
   container publishing, and an optional SSH-based rollout.

The container image follows the existing multi-stage `Dockerfile` and is
published to **GitHub Container Registry (GHCR)** at:

```
ghcr.io/donny-devops/openclaw-revenue-engine
```

---

## Triggering a deployment

### Manual (recommended)

In GitHub, go to **Actions → Deploy → Run workflow**, then choose:

| Input         | Description                                                 |
|---------------|-------------------------------------------------------------|
| `environment` | `staging` (default) or `production`.                        |
| `image_tag`   | Optional override. If empty, the short Git SHA is used.     |
| `skip_tests`  | Skip lint/type-check/tests (use only for emergency rolls).  |

### Automatic on `main`

Every push to `main` triggers the same workflow targeting the `staging`
environment. Validation, container build, smoke test, and publish all run.
The remote rollout step is automatically skipped if no `DEPLOY_HOST` secret
is configured for the environment.

---

## What the workflow does

1. **Validate** — `npm ci`, `npm run lint`, `npm run type-check`, `npm test`,
   `npm run build`. This is the same suite enforced by CI.
2. **Build & publish** — multi-stage Docker build (`Dockerfile`) tagged with
   `latest` (on `main`), short Git SHA, branch ref, and any custom tag passed
   to `workflow_dispatch`. Image is pushed to GHCR using the workflow's
   `GITHUB_TOKEN` (no extra registry credentials required).
3. **Smoke test** — runs the freshly built image and curls `GET /health` until
   it succeeds or times out.
4. **Deploy** — if SSH secrets are configured for the target environment, the
   workflow SSHes into the host, pulls the image, restarts the container with
   `--env-file .env`, and verifies `/health` remotely. If no SSH host is
   configured, the deploy job exits cleanly with a notice — the image is still
   published.
5. **Summary** — image, digest, and per-job status are written to the run
   summary.

---

## Required GitHub configuration

### Permissions (already in the workflow)

```yaml
permissions:
  contents: read
  packages: write   # required to push to GHCR
  id-token: write
```

If the repo's default `GITHUB_TOKEN` permissions are restricted, also enable
**Settings → Actions → General → Workflow permissions → Read and write**
(or grant `packages: write` to this workflow specifically).

### Environments

Create two environments under **Settings → Environments**:

- `staging`
- `production`

Add **required reviewers** to `production` if you want a manual approval gate.

### Secrets

`GITHUB_TOKEN` is provided automatically; no extra registry secrets are needed
for GHCR.

The remote-rollout step is gated on optional secrets. Configure them per
environment only if you want the workflow to actually SSH-deploy:

| Secret           | Required? | Purpose                                                         |
|------------------|-----------|-----------------------------------------------------------------|
| `DEPLOY_HOST`    | optional  | Hostname or IP of the deployment target (e.g. VPS).             |
| `DEPLOY_USER`    | optional  | SSH user.                                                       |
| `DEPLOY_SSH_KEY` | optional  | Private key (PEM) authorized on the host.                       |
| `DEPLOY_PATH`    | optional  | Remote project dir. Defaults to `/opt/openclaw-revenue-engine`. |

If `DEPLOY_HOST` is unset, the deploy job logs a notice and exits successfully
— the image is still published and ready for any other consumer (Fly.io,
Render, AWS ECS, k8s, etc.).

### Runtime environment file

The remote container is started with `--env-file ${DEPLOY_PATH}/.env`. Place a
populated `.env` on the deploy host (use `.env.example` as a template). At
minimum, production deployments must set:

- `NODE_ENV=production`
- `DATABASE_URL`
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
- `JWT_SECRET`
- `REDIS_URL` (if Redis-backed rate limiting is enabled)

---

## Running locally

The script mirrors the workflow so you can reproduce a CI deploy from your
laptop:

```bash
# Build & smoke-test the image locally
./scripts/deploy.sh validate

# Build, validate, and push to GHCR (requires login env vars)
REGISTRY_USERNAME=<github-user> \
REGISTRY_PASSWORD=<github-pat-with-write:packages> \
./scripts/deploy.sh all

# Build → push → SSH-deploy in one shot
REGISTRY_USERNAME=<github-user> \
REGISTRY_PASSWORD=<github-pat> \
DEPLOY_HOST=revenue.example.com \
DEPLOY_USER=deploy \
DEPLOY_SSH_KEY="$(cat ~/.ssh/deploy_key)" \
./scripts/deploy.sh deploy-ssh
```

Run `./scripts/deploy.sh help` for the full subcommand list.

---

## Adapting to a different deployment target

The `build-and-publish` job is provider-agnostic — any platform that pulls a
container image from GHCR will work. To switch off SSH:

- **Fly.io**: replace the `deploy` job with a `superfly/flyctl-actions` step
  using `FLY_API_TOKEN`.
- **Render / Railway**: trigger a deploy hook via `curl` using the platform's
  `RENDER_DEPLOY_HOOK_URL` or equivalent.
- **AWS ECS**: use `aws-actions/amazon-ecs-deploy-task-definition` with role
  assumption via OIDC (the workflow already requests `id-token: write`).
- **Kubernetes**: `kubectl set image` against a kubeconfig stored in a secret.

Keep the validate / build-and-publish jobs and only swap the `deploy` job —
that is the only provider-specific section.

---

## Rollback

Each push publishes an immutable `sha-<short>` tag. To roll back:

1. Run **Actions → Deploy → Run workflow**.
2. Set `image_tag` to the previously good short SHA.
3. Set `skip_tests=true` for fastest path (the image already passed validation
   when it was first built).

The workflow will retag, smoke-test, and re-roll the older image.
