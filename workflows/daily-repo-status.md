# Daily Repository Status Workflow

## Purpose

Provide a quick, repeatable daily health check for `openclaw-revenue-engine` so maintainers can surface blockers early and keep delivery predictable.

## Frequency

- **Every workday** (recommended: before team standup)
- **Owner:** rotating on-call maintainer or designated repo steward

## Daily Checklist

- [ ] Review open pull requests for review status, requested changes, and blockers.
- [ ] Review recent commits and active branch activity.
- [ ] Verify CI/CD status and identify failing required checks.
- [ ] Triage newly opened issues and re-check high-priority open issues.
- [ ] Review dependency and security alerts.
- [ ] Identify stale branches/PRs and decide follow-up action.

### 1) Open Pull Requests

| Check | What to verify | Action if blocked |
|---|---|---|
| Review state | Pending review, approved, or changes requested | Assign reviewer or re-request review |
| Merge readiness | Required checks passing, no conflicts | Ask author to rebase/fix checks |
| Blockers | Missing context, unresolved comments, failing tests | Comment with explicit unblock steps |

### 2) Recent Commits & Branch Activity

| Check | What to verify | Action |
|---|---|---|
| Default branch activity | New commits in last 24h | Confirm deployments/releases are expected |
| Active feature branches | Long-running branches without updates | Nudge owner or archive if obsolete |
| Commit quality | Clear commit scope/messages | Ask for follow-up cleanup in PR comments |

### 3) CI/CD Pipeline Status

| Check | What to verify | Action |
|---|---|---|
| Required CI checks | `CI`, tests, lint/type-check/build | Triage failing jobs and assign owner |
| Security checks | CodeQL / dependency / secret scan status | Open issue for unresolved high-risk findings |
| Workflow health | Disabled, flaky, or repeatedly failing workflows | Create a workflow-fix issue and prioritize |

### 4) Open Issues (Triaged or Newly Filed)

| Check | What to verify | Action |
|---|---|---|
| New issues | Repro details, labels, severity | Add labels + assign milestone/owner |
| Existing open issues | Priority still accurate | Re-prioritize and update status comment |
| Incident/security items | Time-sensitive items surfaced | Escalate in standup/Slack immediately |

### 5) Dependency / Security Alerts

| Check | What to verify | Action |
|---|---|---|
| Dependabot alerts | High/critical package alerts | Open/merge update PRs quickly |
| Code scanning alerts | New or reopened alerts | Triage false positives vs required fixes |
| Secret exposure alerts | Any leaked key/token warnings | Rotate secrets and remediate immediately |

### 6) Stale Branches / PRs

| Check | What to verify | Action |
|---|---|---|
| Stale PRs | No update for 7+ days | Ping owner; close if abandoned |
| Stale branches | Old branches not linked to active PR | Delete after confirming safe to remove |
| Draft PR drift | Drafts with unresolved TODOs | Request plan/date or archive |

## Reporting Guidance

- Share a short update in **team standup**:
  - PRs blocked
  - CI/security failures
  - priority issues needing help
- Post async summary in **Slack** (or team channel) when standup is not available.
- Use **GitHub Discussions** (or issue comments) for repo-level decisions and longer context.

Suggested daily update format:

- `PRs:` 2 blocked, 4 in review
- `CI:` 1 failing workflow (`CI` on `feature/x`)
- `Issues:` 1 new high-priority bug triaged
- `Security:` 0 critical alerts open
- `Stale:` 3 PRs >7 days, owners notified

## Owner / Responsibility

| Role | Responsibility |
|---|---|
| Daily status owner | Run checklist, post summary, assign follow-ups |
| PR authors | Resolve review comments and failing checks |
| Reviewers/maintainers | Review promptly and escalate blockers |
| Security owner (or maintainer) | Triage/resolve high-risk alerts |

## Notes / References

- Repository: `donny-devops/openclaw-revenue-engine`
- Pull Requests: `https://github.com/donny-devops/openclaw-revenue-engine/pulls`
- Issues: `https://github.com/donny-devops/openclaw-revenue-engine/issues`
- Actions: `https://github.com/donny-devops/openclaw-revenue-engine/actions`
- Security tab: `https://github.com/donny-devops/openclaw-revenue-engine/security`
