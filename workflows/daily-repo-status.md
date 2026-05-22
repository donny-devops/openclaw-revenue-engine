# Daily Repository Status Workflow

## Purpose

Run a daily operational check to keep `openclaw-revenue-engine` healthy by surfacing delivery blockers, CI risk, security alerts, and stale work that could slow GTM execution.

## Frequency

| Cadence | Time Window | Duration | Trigger |
|---|---|---|---|
| Daily (Mon–Fri) | Before team standup (local team time) | 10–15 min | Start-of-day repo health review |

## Checklist

### 1) Open pull requests

- [ ] Review all open PRs for current status (`ready for review`, `changes requested`, `blocked`)
- [ ] Confirm required reviewers are assigned
- [ ] Record blockers, missing approvals, or failing checks per PR

### 2) Recent commits and branch activity

- [ ] Review commits from the last 24 hours on `main` and active feature branches
- [ ] Check for force-pushes, large unreviewed changes, or branch drift from `main`
- [ ] Flag branches inactive for 7+ days

### 3) CI/CD pipeline status

- [ ] Check latest workflow runs (CI, tests, security scans, packaging)
- [ ] Identify failing or `action_required` runs and assign an owner
- [ ] Verify release/deploy workflows are green for production-facing branches

### 4) Issues triage

- [ ] Review newly opened issues since last check
- [ ] Confirm labels, priority, and owner assignment are set
- [ ] Escalate P0/P1 incidents and unblock items tied to active PRs

### 5) Dependency and security posture

- [ ] Check Dependabot and dependency review outcomes
- [ ] Review open CodeQL/secret scanning/security alerts
- [ ] Capture remediation owner and target date for each active alert

### 6) Stale branches and stale PRs

- [ ] Identify open PRs with no activity for 3+ days
- [ ] Identify branches with no commits for 14+ days
- [ ] Close, merge, or archive stale work after owner confirmation

## Reporting

Use the following reporting format each day:

| Channel | What to Post | Audience |
|---|---|---|
| Team standup | Top blockers, red CI runs, urgent issues | Engineering + RevenueOps |
| Slack (`#repo-ops` or team channel) | Daily repo health summary and owners/action items | Broader delivery team |
| GitHub Discussion (weekly rollup) | Trends: stale PR count, CI health, security posture | Repo maintainers/stakeholders |

Recommended summary template:

- [ ] **PR health:** `X open`, `Y blocked`, `Z ready to merge`
- [ ] **CI health:** `A passing`, `B failing/action_required`
- [ ] **Issues:** `N new`, `M triaged`, `P escalated`
- [ ] **Security:** `S open alerts`, `R remediations in progress`
- [ ] **Stale work:** `K stale PRs`, `L stale branches`, owners tagged

## Owner

| Role | Primary Owner | Backup Owner |
|---|---|---|
| Daily Repo Status Operator | Repository maintainer on duty (or rotating RevenueOps engineer) | Engineering lead / on-call maintainer |

## Notes / References

- GitHub Pull Requests: `https://github.com/donny-devops/openclaw-revenue-engine/pulls`
- GitHub Actions Runs: `https://github.com/donny-devops/openclaw-revenue-engine/actions`
- GitHub Issues: `https://github.com/donny-devops/openclaw-revenue-engine/issues`
- Security Overview: `https://github.com/donny-devops/openclaw-revenue-engine/security`
- Suggested CLI helpers:
  - `gh pr list --repo donny-devops/openclaw-revenue-engine`
  - `gh run list --repo donny-devops/openclaw-revenue-engine`
  - `gh issue list --repo donny-devops/openclaw-revenue-engine`
