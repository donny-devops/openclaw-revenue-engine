# Daily Repository Status Workflow

## Purpose

Run a quick daily health check for `openclaw-revenue-engine`.

Use this workflow to surface blockers early, keep reviews moving, and make
repository operations predictable.

## Frequency

- Cadence: every workday before standup.
- Owner: rotating on-call maintainer or repo steward.
- Backup: another maintainer when the owner is unavailable.

## Daily Checklist

- [ ] Review open pull requests.
- [ ] Review recent commits and branch activity.
- [ ] Check CI/CD status.
- [ ] Triage new and high-priority issues.
- [ ] Review dependency and security alerts.
- [ ] Identify stale branches and pull requests.

## Open Pull Requests

Check each open pull request for:

- Review state: pending, approved, or changes requested.
- Merge readiness: checks, conflicts, and required approvals.
- Blockers: missing context, unresolved comments, or failing tests.

Follow-up actions:

- Assign or re-request reviewers.
- Ask the author to rebase or fix failing checks.
- Comment with clear unblock steps when a PR is stuck.

## Recent Commits And Branch Activity

Review recent activity for:

- New commits on the default branch in the last 24 hours.
- Active feature branches that have not moved recently.
- Commit messages that need clearer scope or context.

Follow-up actions:

- Confirm default-branch changes were expected.
- Nudge owners of long-running branches.
- Archive obsolete branches after confirming they are safe to remove.

## CI/CD Pipeline Status

Check workflow health for:

- Required CI checks.
- Lint, type-check, unit test, audit, and build jobs.
- Security checks such as CodeQL, dependency review, and secret scans.
- Disabled, flaky, or repeatedly failing workflows.

Follow-up actions:

- Assign an owner for failing required checks.
- Open an issue for unresolved high-risk findings.
- Prioritize fixes for flaky or broken workflows.

## Open Issues

Review issues for:

- New reports that need labels, severity, or an owner.
- Existing issues whose priority may have changed.
- Incident or security items that need escalation.

Follow-up actions:

- Add labels and owners.
- Update stale issue status comments.
- Escalate time-sensitive items in standup or Slack.

## Dependency And Security Alerts

Review security posture for:

- Dependabot alerts.
- Code scanning alerts.
- Secret exposure alerts.
- Open security pull requests.

Follow-up actions:

- Prioritize high and critical dependency alerts.
- Triage false positives versus required fixes.
- Rotate exposed secrets immediately.

## Stale Branches And Pull Requests

Check for stale work:

- Pull requests with no update for seven or more days.
- Branches not linked to active pull requests.
- Draft pull requests with unresolved TODOs.

Follow-up actions:

- Ping the owner.
- Request a plan or target date.
- Close or delete abandoned work after confirming it is safe.

## Reporting Guidance

Share a short daily update in standup or Slack.

Suggested format:

- `PRs:` 2 blocked, 4 in review.
- `CI:` 1 failing workflow on `feature/x`.
- `Issues:` 1 high-priority bug triaged.
- `Security:` 0 critical alerts open.
- `Stale:` 3 old pull requests, owners notified.

Use GitHub Discussions or issue comments for repo-level decisions that need
longer context.

## Owner Responsibility

The daily status owner should:

- Run the checklist.
- Post the summary.
- Assign follow-up owners.
- Escalate urgent blockers.

Pull request authors should resolve review comments and failing checks.

Reviewers and maintainers should review promptly and escalate blockers.

The security owner should triage and resolve high-risk alerts.

## Notes And References

- Repository: `donny-devops/openclaw-revenue-engine`
- Pull requests: repository Pull Requests tab
- Issues: repository Issues tab
- Actions: repository Actions tab
- Security: repository Security tab
