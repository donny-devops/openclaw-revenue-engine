# TOOLS.md

> Step-by-step playbooks for how to use each tool. Read alongside [[MEMORY.md]].
> When a procedure fails, **update this file** (append a dated note under the relevant section) so the mistake doesn't repeat.

_Last updated: 2026-04-24_

---

## Index

1. [Shell (PowerShell)](#1-shell-powershell)
2. [Git & GitHub](#2-git--github)
3. [Docker](#3-docker)
4. [Browser](#4-browser) ← the one you keep breaking
5. [Obsidian vault](#5-obsidian-vault)
6. [Telegram bot](#6-telegram-bot)
7. [Postman / API testing](#7-postman--api-testing)
8. [GitHub Actions debugging](#8-github-actions-debugging)

---

## 1. Shell (PowerShell)

Default shell. Not bash.

- **Paths:** `C:\Users\iliana\...` or `"C:/Users/iliana/..."`. Never `~/`.
- **Env vars:** `$env:FOO = "bar"`, read with `$env:FOO`. Not `export`.
- **Running scripts:** `pwsh -File .\script.ps1`. If execution policy blocks, say so, don't silently `Set-ExecutionPolicy`.
- **Piping:** PowerShell pipes objects, not text. Don't assume `grep` works — use `Select-String` or `Where-Object`.
- **Long one-liners:** break with backtick `` ` `` at end of line. Not `\`.
- **Quoting:** single-quotes are literal, double-quotes expand variables. Pick intentionally.

If I say "run a command" without specifying, **assume PowerShell**. Confirm once if unsure.

## 2. Git & GitHub

- Use the GitHub MCP / connector whenever possible — not web scraping.
- Branch naming: `feat/<slug>`, `fix/<slug>`, `chore/<slug>`, `ci/<slug>`.
- Before committing:
  1. `git status` — show me what changed.
  2. Group related changes into one commit; split unrelated ones.
  3. Conventional Commit message, ≤ 72 char subject, wrapped body.
- Before pushing:
  - `git fetch && git rebase origin/main` on feature branches.
  - Never `--force`. Use `--force-with-lease` only on my branches.
- PRs: open as **draft** unless I say otherwise. Body must have: *what*, *why*, *how tested*, *risks*.

## 3. Docker

- `docker compose` (v2, space), not `docker-compose`.
- Always build with `--pull` in CI; locally, only when I ask.
- Tag images with git SHA + semver: `myapp:1.2.3-abc1234`.
- Non-root `USER` in every Dockerfile. Multi-stage. Copy `package.json` + lockfile before app code to preserve cache.
- Never push to a registry without me saying "push".

## 4. Browser

**This is the section you forget. Read it every time.**

### 4.1 Ground rules

1. **Announce the plan.** Before any navigation, say in one line: *goal, URL, expected outcome*. Example: "Navigating to github.com/iliana/repo/actions to find the last failing run."
2. **Never log into my accounts.** No credentials, no SSO, no 2FA. If auth is required, stop and report: "site requires login — how do you want to proceed?"
3. **Prefer structured access.** If there's an API, MCP server, or connector for the site, use that instead of the visible UI. Web UI is last resort.
4. **One goal per session.** Don't wander. If you need to check something else, finish the current task, then say "starting new browser task: …".

### 4.2 The step-by-step

For every browser task, walk this list:

1. **State goal + URL.**
2. **Open the URL.** Wait for full load. Don't act on half-rendered pages.
3. **Screenshot.** Confirm you're on the page you think.
4. **Locate the target** element using, in order of preference:
   - stable selectors (id, `data-testid`, aria-label)
   - visible text
   - position (absolute last resort — brittle)
5. **Act** (click / type / select). One action at a time.
6. **Screenshot again.** Confirm the action had the expected effect.
7. **If something's off, stop.** Don't try to brute-force. Report what you see, suggest next step, wait.
8. **When done**, summarize: URL ended on, what was extracted/done, any surprises.

### 4.3 Pop-ups, modals, cookie banners

- **Expect them** on almost every non-trivial site.
- Before interacting with the page's main content, sweep for: cookie banner, newsletter modal, paywall, "are you over 18", login prompt.
- If a modal is blocking and you can't dismiss it with "Close"/"Reject all"/"X", stop and ask me.

### 4.4 Forms

- Fill fields in visual/DOM order.
- After each required field, verify the value is set (some sites use JS controlled inputs that silently drop pastes).
- **Never submit** a form that has consequences (payment, account creation, message send, subscribe) without explicit "submit" from me.

### 4.5 Dynamic content (SPAs, infinite scroll)

- Expect content to load async. Wait for a specific element, not a fixed timer.
- Infinite scroll: scroll, wait for new rows to render, check a known selector increased in count. Don't scroll blindly.

### 4.6 Search engines and scraping

- If you're about to scrape search results, first ask: is there a search API / MCP connector / structured feed? Use that instead.
- If you must use a browser: set a reasonable rate, don't open 30 tabs in parallel.

### 4.7 Screenshots discipline

- Name them with context: `before-click-submit.png`, `after-form-error.png`.
- Attach to the conversation immediately; don't just store them silently.

### 4.8 When the browser misbehaves

Common failure modes and the fix (update this list as we learn):

| Symptom | Likely cause | Fix |
|---|---|---|
| Element found but click does nothing | iframe / shadow DOM | switch frame / pierce shadow root, or use keyboard shortcut |
| Typing into field, nothing saved | React controlled input | focus → clear → type with delay → blur |
| Page blank after navigation | anti-bot / Cloudflare | stop, report, ask me to hand off |
| Element selector works locally, not in headless | viewport size differs | set viewport explicitly (1440×900) |
| Search results look stale | cached page | hard reload, or add cache-busting query param |

### 4.9 What to NEVER do in the browser

- Never submit payment forms, even in "test mode", without explicit confirmation.
- Never dismiss a consent/ToS dialog on my behalf.
- Never create accounts.
- Never download executables.
- Never click links in emails from a browser session tied to my accounts.

## 5. Obsidian vault

- Load the vault's `AGENT.md` before read/write.
- Quick captures → `00-Inbox/YYYY-MM-DD-HHMM-<slug>.md`.
- Every note gets frontmatter (see `AGENT.md` §Required frontmatter).
- Link from a MOC in the same turn you create a note.
- Use the Obsidian MCP server if configured; fall back to filesystem only if not.

## 6. Telegram bot

- One topic = one thread = one context window.
- `/status` at session start. `/compact` at ~70% context. `/reset` when switching sub-topic.
- `/note <text>` → lands in Obsidian `00-Inbox/`.
- Never DM the bot outside the allowed group (bot checks `ALLOWED_CHAT_ID`; requests elsewhere should return silently).

## 7. Postman / API testing

- Collections live in the repo under `postman/`. Never store secrets in the collection — use environments, and environments live outside git.
- Requests should have tests (`pm.test(...)`) for status + schema.
- For CI, run with `newman` against an environment file injected from a secret.

## 8. GitHub Actions debugging

Standard recipe:

1. Open the failing run. Find the first red step (not the first red job — they cascade).
2. Expand the step. Look at the **last 50 lines** before the non-zero exit.
3. Re-run with debug logging: set `ACTIONS_STEP_DEBUG=true` and `ACTIONS_RUNNER_DEBUG=true` as repo secrets, rerun with debug logging enabled.
4. Reproduce locally with [`act`](https://github.com/nektos/act) if the step is self-contained.
5. Common causes to check in order:
   - Cache key collision / stale cache
   - Missing secret (empty env var)
   - Action version drift (use SHA pins)
   - Runner image update broke something (see runner changelog)
   - Rate limit (GitHub, npm, Docker Hub) — back off, add auth

---

## SESSION NOTES

<!-- Append `## SESSION NOTES — YYYY-MM-DD` blocks below when you learn something new about a tool. -->
