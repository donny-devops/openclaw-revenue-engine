# Security Integrations

This document defines the first security tool integrations for the OpenClaw revenue
engine. The default posture is conservative: scans are explicit, credentialed
operations are disabled until configured, and outputs require operator review.

## OWASP ZAP Baseline

The ZAP baseline workflow is manual only. An operator supplies the target URL at
runtime and decides whether ZAP findings should fail the workflow.

Use this for lightweight web application security checks against a deployed
staging or preview environment. Do not aim it at third-party systems unless you
own the target or have written authorization.

## Zeek Network Analysis

The Zeek workflow analyzes packet capture fixtures stored under
`security/pcaps`. If there are no `.pcap` or `.pcapng` files, the workflow exits
cleanly and reports that no packet captures were analyzed.

Recommended usage:

- Store only sanitized packet captures.
- Avoid production customer payloads.
- Review generated Zeek logs before sharing them externally.
- Treat DNS, HTTP, TLS, and connection logs as potentially sensitive telemetry.

## Greenbone Community Edition

Greenbone is registered as a planned vulnerability-assessment integration. It is
disabled by default because authenticated vulnerability scanning needs explicit
operator approval, target ownership, and credential handling.

Required secret names when enabled:

- `GREENBONE_URL`
- `GREENBONE_USERNAME`
- `GREENBONE_PASSWORD`

## Splunk Log Ingestion

Splunk-compatible HTTP Event Collector forwarding is registered but disabled by
default. The intended use is curated security telemetry, workflow events, and
agent audit events.

Required secret names when enabled:

- `SPLUNK_HEC_URL`
- `SPLUNK_HEC_TOKEN`

## Guardrails

- Manual dynamic application security targets only.
- Packet capture fixtures only.
- No raw secret echoing.
- No credentialed scans without operator approval.
- External log forwarding disabled by default.
- Findings should become issues, risk-register entries, or operator tasks.
