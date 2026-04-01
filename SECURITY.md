# Security Policy

## Supported Versions

Security updates are provided for the actively maintained `main` branch and any currently released stable version tags.

| Version | Supported |
| --- | --- |
| main | Yes |
| latest stable release | Yes |
| older versions | No |

## Reporting a Vulnerability

If you believe you have found a security vulnerability in `openclaw-revenue-engine`, please report it privately rather than opening a public issue.

Please include:
- A clear description of the issue.
- The affected component, endpoint, workflow, or configuration.
- Steps to reproduce, if available.
- Any relevant logs, screenshots, or proof of concept.
- Your preferred contact information for follow-up.

## What to Report

Please report:
- Authentication or authorization bypasses.
- Injection issues, including SQL, command, template, or serialization-related risks.
- Secrets exposure in code, logs, build artifacts, or CI/CD output.
- Broken access control or tenant/data isolation issues.
- Dependency, container, or infrastructure misconfigurations that create security risk.
- Supply chain issues affecting builds, deployments, or released artifacts.

## What Not to Report

Please do not report:
- Low-impact bugs with no security effect.
- General feature requests.
- Non-sensitive configuration questions.
- Issues already fixed in a newer version.

## Security Practices

This repository is maintained with a security-first approach:
- Secrets must never be committed to source control.
- Environment variables or a secrets manager should be used for sensitive values.
- Dependencies should be kept current and reviewed regularly.
- Build and deployment pipelines should use least-privilege credentials.
- Security scanning should be enabled where practical, including dependency and container scanning.
- Access to production systems should be restricted and auditable.

## Response Expectations

We will acknowledge confirmed security reports as soon as practical and work with you to validate, triage, and resolve the issue.

Please do not publicly disclose a vulnerability until a maintainer has had a chance to review and remediate it.

## Scope

This policy applies only to the code and configuration in this repository. Any deployed environment must also be secured independently according to its own operational requirements.

## Safe Harbor

We consider security research to be conducted in good faith if it is:
- Limited to the minimum necessary to demonstrate a vulnerability.
- Performed without harming users, systems, or data.
- Not used for extortion, disruption, or unauthorized access.

Thanks for helping keep `openclaw-revenue-engine` secure.
