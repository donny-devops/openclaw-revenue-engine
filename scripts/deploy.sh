#!/usr/bin/env bash
# =============================================================================
# openclaw-revenue-engine — Deployment Script
#
# Builds, validates, and (optionally) publishes a Docker image for the revenue
# engine. Designed to be runnable from a developer workstation OR from a
# GitHub Actions workflow (.github/workflows/deploy.yml).
#
# Usage:
#   ./scripts/deploy.sh build                  # build image locally
#   ./scripts/deploy.sh validate               # build + smoke-test container
#   ./scripts/deploy.sh push                   # build + push to registry
#   ./scripts/deploy.sh deploy-ssh             # push image, then ssh-deploy
#   ./scripts/deploy.sh all                    # build + validate + push
#
# Environment variables (with safe defaults):
#   IMAGE_NAME           Image name (default: openclaw-revenue-engine)
#   IMAGE_TAG            Image tag  (default: git short sha, or "local")
#   REGISTRY             Container registry (default: ghcr.io)
#   REGISTRY_NAMESPACE   Registry namespace/owner (default: donny-devops)
#   REGISTRY_USERNAME    Registry login user (required for push)
#   REGISTRY_PASSWORD    Registry login token (required for push)
#   PLATFORMS            buildx target platforms (default: linux/amd64)
#   ENVIRONMENT          Logical env label: staging|production (default: staging)
#
# SSH deploy variables (only required for `deploy-ssh`):
#   DEPLOY_HOST          Target host (e.g. revenue.example.com)
#   DEPLOY_USER          SSH user
#   DEPLOY_SSH_KEY       Private key contents (multi-line) OR path to key file
#   DEPLOY_PATH          Remote project dir (default: /opt/openclaw-revenue-engine)
#
# Exit codes:
#   0 success, non-zero on failure. Script uses `set -euo pipefail`.
# =============================================================================

set -euo pipefail

# ---- Configuration -----------------------------------------------------------

IMAGE_NAME="${IMAGE_NAME:-openclaw-revenue-engine}"
REGISTRY="${REGISTRY:-ghcr.io}"
REGISTRY_NAMESPACE="${REGISTRY_NAMESPACE:-donny-devops}"
PLATFORMS="${PLATFORMS:-linux/amd64}"
ENVIRONMENT="${ENVIRONMENT:-staging}"
DEPLOY_PATH="${DEPLOY_PATH:-/opt/openclaw-revenue-engine}"

# Default tag: short git sha if available, else "local"
if [[ -z "${IMAGE_TAG:-}" ]]; then
  if git rev-parse --short HEAD >/dev/null 2>&1; then
    IMAGE_TAG="$(git rev-parse --short HEAD)"
  else
    IMAGE_TAG="local"
  fi
fi

FULL_IMAGE="${REGISTRY}/${REGISTRY_NAMESPACE}/${IMAGE_NAME}:${IMAGE_TAG}"
LATEST_IMAGE="${REGISTRY}/${REGISTRY_NAMESPACE}/${IMAGE_NAME}:latest"

# ---- Helpers -----------------------------------------------------------------

log()  { printf '\033[1;34m[deploy]\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m[deploy:warn]\033[0m %s\n' "$*" >&2; }
err()  { printf '\033[1;31m[deploy:err]\033[0m %s\n' "$*" >&2; }

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    err "required command not found: $1"
    exit 127
  fi
}

require_var() {
  local name="$1"
  if [[ -z "${!name:-}" ]]; then
    err "required environment variable not set: $name"
    exit 2
  fi
}

# ---- Steps -------------------------------------------------------------------

cmd_build() {
  require_cmd docker
  log "Building image ${FULL_IMAGE} (platforms=${PLATFORMS})"
  docker build \
    --platform "${PLATFORMS}" \
    --tag "${FULL_IMAGE}" \
    --tag "${LATEST_IMAGE}" \
    --label "org.opencontainers.image.source=https://github.com/${REGISTRY_NAMESPACE}/${IMAGE_NAME}" \
    --label "org.opencontainers.image.revision=${IMAGE_TAG}" \
    --label "org.opencontainers.image.environment=${ENVIRONMENT}" \
    .
  log "Built ${FULL_IMAGE}"
}

cmd_validate() {
  require_cmd docker
  log "Validating image ${FULL_IMAGE} via container smoke test"

  # Make sure image exists locally; if not, build it.
  if ! docker image inspect "${FULL_IMAGE}" >/dev/null 2>&1; then
    cmd_build
  fi

  local cid
  cid="$(docker run -d --rm \
    -e NODE_ENV=production \
    -e PORT=3000 \
    -p 13000:3000 \
    "${FULL_IMAGE}")"

  log "Started smoke-test container ${cid}; waiting for /health"
  local ok=0
  for i in $(seq 1 20); do
    if curl -fsS "http://127.0.0.1:13000/health" >/dev/null 2>&1; then
      ok=1
      break
    fi
    sleep 1
  done

  docker logs "${cid}" 2>&1 | tail -n 50 || true
  docker stop "${cid}" >/dev/null 2>&1 || true

  if [[ "${ok}" -ne 1 ]]; then
    err "container failed health check"
    exit 1
  fi
  log "Validation passed"
}

cmd_login() {
  require_cmd docker
  require_var REGISTRY_USERNAME
  require_var REGISTRY_PASSWORD
  log "Logging into ${REGISTRY} as ${REGISTRY_USERNAME}"
  printf '%s' "${REGISTRY_PASSWORD}" | docker login "${REGISTRY}" \
    --username "${REGISTRY_USERNAME}" \
    --password-stdin
}

cmd_push() {
  require_cmd docker
  cmd_login
  if ! docker image inspect "${FULL_IMAGE}" >/dev/null 2>&1; then
    cmd_build
  fi
  log "Pushing ${FULL_IMAGE}"
  docker push "${FULL_IMAGE}"
  log "Pushing ${LATEST_IMAGE}"
  docker push "${LATEST_IMAGE}"
}

cmd_deploy_ssh() {
  require_cmd ssh
  require_var DEPLOY_HOST
  require_var DEPLOY_USER
  require_var DEPLOY_SSH_KEY

  cmd_push

  local key_file
  if [[ -f "${DEPLOY_SSH_KEY}" ]]; then
    key_file="${DEPLOY_SSH_KEY}"
  else
    key_file="$(mktemp)"
    chmod 600 "${key_file}"
    printf '%s\n' "${DEPLOY_SSH_KEY}" > "${key_file}"
    trap 'rm -f "${key_file}"' EXIT
  fi

  log "Deploying ${FULL_IMAGE} to ${DEPLOY_USER}@${DEPLOY_HOST}:${DEPLOY_PATH}"
  ssh -o StrictHostKeyChecking=accept-new \
      -i "${key_file}" \
      "${DEPLOY_USER}@${DEPLOY_HOST}" \
      "set -euo pipefail; \
       mkdir -p '${DEPLOY_PATH}'; \
       cd '${DEPLOY_PATH}'; \
       echo '${REGISTRY_PASSWORD}' | docker login '${REGISTRY}' -u '${REGISTRY_USERNAME}' --password-stdin; \
       docker pull '${FULL_IMAGE}'; \
       docker rm -f openclaw-revenue-engine 2>/dev/null || true; \
       docker run -d \
         --name openclaw-revenue-engine \
         --restart unless-stopped \
         --env-file ${DEPLOY_PATH}/.env \
         -p 3000:3000 \
         '${FULL_IMAGE}'; \
       docker image prune -f"
  log "Remote deploy complete"
}

cmd_all() {
  cmd_build
  cmd_validate
  cmd_push
}

# ---- Dispatch ----------------------------------------------------------------

main() {
  local cmd="${1:-help}"
  case "${cmd}" in
    build)        cmd_build ;;
    validate)     cmd_validate ;;
    login)        cmd_login ;;
    push)         cmd_push ;;
    deploy-ssh)   cmd_deploy_ssh ;;
    all)          cmd_all ;;
    help|-h|--help)
      sed -n '2,40p' "$0"
      ;;
    *)
      err "unknown command: ${cmd}"
      sed -n '2,40p' "$0"
      exit 64
      ;;
  esac
}

main "$@"
