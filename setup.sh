#!/usr/bin/env bash
set -euo pipefail

# ─────────────────────────────────────────────────────────────────────────────
# openclaw-revenue-engine — setup script
#
# Installs Node.js and Python dependencies, creates a .env file from the
# template if one doesn't exist, and runs lint + type-check + tests to
# verify the environment is ready.
# ─────────────────────────────────────────────────────────────────────────────

REQUIRED_NODE_MAJOR=22
REQUIRED_PYTHON_MINOR=11   # 3.11+

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BOLD='\033[1m'
NC='\033[0m'

info()  { printf "${GREEN}[setup]${NC} %s\n" "$*"; }
warn()  { printf "${YELLOW}[setup]${NC} %s\n" "$*"; }
fail()  { printf "${RED}[setup]${NC} %s\n" "$*" >&2; exit 1; }

cd "$(dirname "$0")"

# ── 1. Check Node.js ────────────────────────────────────────────────────────
info "Checking Node.js …"
if ! command -v node &>/dev/null; then
  fail "Node.js is not installed. Install Node.js >= $REQUIRED_NODE_MAJOR from https://nodejs.org"
fi

NODE_MAJOR=$(node -e "console.log(process.versions.node.split('.')[0])")
if (( NODE_MAJOR < REQUIRED_NODE_MAJOR )); then
  fail "Node.js v$REQUIRED_NODE_MAJOR+ required (found v$(node --version)). Please upgrade."
fi
info "  Node.js $(node --version) ✓"

# ── 2. Check Python ─────────────────────────────────────────────────────────
info "Checking Python …"
PYTHON=""
for candidate in python3 python; do
  if command -v "$candidate" &>/dev/null; then
    PYTHON="$candidate"
    break
  fi
done
if [[ -z "$PYTHON" ]]; then
  fail "Python 3 is not installed. Install Python >= 3.$REQUIRED_PYTHON_MINOR from https://python.org"
fi

PY_VERSION=$($PYTHON --version 2>&1 | grep -oP '\d+\.\d+')
PY_MINOR=$(echo "$PY_VERSION" | cut -d. -f2)
if (( PY_MINOR < REQUIRED_PYTHON_MINOR )); then
  fail "Python 3.$REQUIRED_PYTHON_MINOR+ required (found $($PYTHON --version)). Please upgrade."
fi
info "  $($PYTHON --version) ✓"

# ── 3. Install Node.js dependencies ─────────────────────────────────────────
info "Installing Node.js dependencies …"
npm ci
info "  npm ci ✓"

# ── 4. Set up Python virtual environment and install deps ────────────────────
VENV_DIR=".venv"
if [[ ! -d "$VENV_DIR" ]]; then
  info "Creating Python virtual environment in $VENV_DIR …"
  $PYTHON -m venv "$VENV_DIR"
fi

info "Installing Python dependencies …"
"$VENV_DIR/bin/pip" install --upgrade pip --quiet
"$VENV_DIR/bin/pip" install -r requirements.txt pytest --quiet
info "  pip install ✓"

# ── 5. Create .env from template if missing ──────────────────────────────────
if [[ ! -f .env ]]; then
  info "Creating .env from .env.example …"
  cp .env.example .env
  warn "  ⚠  .env created — edit it with your real credentials before running the app."
else
  info "  .env already exists, skipping."
fi

# ── 6. Verify the setup ─────────────────────────────────────────────────────
info "Running verification checks …"

printf "\n${BOLD}── TypeScript type-check ──${NC}\n"
npx tsc --noEmit
info "  type-check ✓"

printf "\n${BOLD}── ESLint ──${NC}\n"
npx eslint . --ext .ts
info "  lint ✓"

printf "\n${BOLD}── Python unit tests ──${NC}\n"
"$VENV_DIR/bin/pytest" tests/unit/ -v
info "  pytest ✓"

printf "\n${BOLD}── Node.js tests ──${NC}\n"
npx jest --testPathPattern='tests/(unit|integration)' --forceExit
info "  jest ✓"

# ── Done ─────────────────────────────────────────────────────────────────────
printf "\n${GREEN}${BOLD}Setup complete!${NC}\n"
printf "\n"
printf "  ${BOLD}Quick start:${NC}\n"
printf "    npm run dev              Start the dev server (TypeScript webhooks)\n"
printf "    $VENV_DIR/bin/python main.py --once --dry-run   Dry-run the README generator lane\n"
printf "    npm test                 Run all Node.js tests\n"
printf "    $VENV_DIR/bin/pytest tests/unit/ -v   Run Python unit tests\n"
printf "\n"
printf "  ${YELLOW}Don't forget to fill in .env with real credentials before going live.${NC}\n"
