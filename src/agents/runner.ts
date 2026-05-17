import crypto from 'crypto';

import { planMcpUsage } from '../mcp/planner';
import { evaluateGuardrails, highestRisk } from './guardrails';
import { selectModelProfile } from './modelRouter';
import { loadAgentManifest, loadAgentManifests, loadModelRoutingPolicy } from './registry';
import { AgentRunInput, AgentRunResult, AgentStatus } from './types';

function buildActions(agentId: string, risk: string): string[] {
  if (agentId === 'compliance_review_agent') {
    return risk === 'low'
      ? ['Approve low-risk internal summary.', 'Keep delivery logs for audit traceability.']
      : ['Block external delivery until findings are remediated.', 'Escalate to a human reviewer.'];
  }

  return risk === 'low'
    ? ['Summarize webhook or billing signal.', 'Check recent deployment and provider status.', 'Prepare reversible remediation steps.']
    : ['Pause destructive action.', 'Collect provider event IDs and request IDs.', 'Route to Compliance Review Agent.'];
}

function buildSummary(agentName: string, objective: string, risk: string): string {
  return `${agentName} evaluated the request as ${risk} risk: ${objective}`;
}

function statusFor(reviewRequired: boolean, findingsCount: number): AgentStatus {
  if (reviewRequired) return 'requires_human_review';
  if (findingsCount > 0) return 'blocked';
  return 'completed';
}

export function listAgents() {
  return loadAgentManifests().map((agent) => ({
    agent_id: agent.agent_id,
    name: agent.name,
    description: agent.description,
    model_profile: agent.model_profile,
    allowed_tools: agent.allowed_tools,
    mcp_plan: planMcpUsage(agent),
  }));
}

export function runAgent(input: AgentRunInput): AgentRunResult {
  const manifest = loadAgentManifest(input.agent_id);
  const policy = loadModelRoutingPolicy();
  const selectedProfile = selectModelProfile(input.objective, policy, manifest.model_profile);
  const guardrail = evaluateGuardrails(input);
  const risk = highestRisk(guardrail.findings);
  const modelRequiresReview = selectedProfile.profile.human_review_required;
  const manifestRequiresReview = Boolean(
    manifest.guardrails.require_human_review_for_refunds
      || manifest.guardrails.require_human_review_for_customer_impact,
  );
  const humanReviewRequired =
    modelRequiresReview ||
    (manifestRequiresReview && risk !== 'low') ||
    risk === 'critical';

  const recommendedActions = buildActions(manifest.agent_id, risk);
  const mcpPlan = planMcpUsage(manifest);

  return {
    request_id: input.request_id ?? crypto.randomUUID(),
    agent_id: manifest.agent_id,
    agent_name: manifest.name,
    model_profile: selectedProfile.profile_id,
    status: statusFor(humanReviewRequired, guardrail.findings.length),
    risk_level: risk,
    summary: buildSummary(manifest.name, guardrail.redactedText.split('\n')[0], risk),
    recommended_actions: recommendedActions,
    findings: guardrail.findings,
    redactions: guardrail.redactions,
    mcp_plan: mcpPlan,
    human_review_required: humanReviewRequired,
    telemetry: {
      input_chars: JSON.stringify(input).length,
      output_actions: recommendedActions.length,
      guardrail_findings: guardrail.findings.length,
      mcp_plan_steps: mcpPlan.length,
    },
  };
}
