import { evaluateGuardrails } from '../../src/agents/guardrails';
import { selectModelProfile } from '../../src/agents/modelRouter';
import { loadAgentManifest, loadAgentManifests, loadModelRoutingPolicy } from '../../src/agents/registry';
import { runAgent } from '../../src/agents/runner';

describe('agent runtime', () => {
  it('loads agent manifests from repository JSON files', () => {
    const agents = loadAgentManifests();
    expect(agents.length).toBeGreaterThanOrEqual(2);
    expect(agents.map((agent) => agent.agent_id)).toEqual(
      expect.arrayContaining(['revenue_ops_agent', 'compliance_review_agent']),
    );
  });

  it('throws for an unknown agent id', () => {
    expect(() => loadAgentManifest('missing_agent')).toThrow('Unknown agent_id');
  });

  it('routes customer-impact objectives to the compliance profile', () => {
    const policy = loadModelRoutingPolicy();
    const selected = selectModelProfile('refund customer after payment dispute', policy);
    expect(selected.profile_id).toBe('compliance_strict');
  });

  it('detects and redacts secret-like language', () => {
    const result = evaluateGuardrails({
      agent_id: 'revenue_ops_agent',
      objective: 'Investigate webhook failure with api_key in logs',
    });
    expect(result.findings.map((finding) => finding.rule_id)).toContain('secret_exposure');
    expect(result.redactions).toContain('secret_like_value');
  });

  it('runs revenue ops agent with low-risk output', () => {
    const result = runAgent({
      request_id: 'req-agent-1',
      agent_id: 'revenue_ops_agent',
      objective: 'Summarize webhook health check status',
    });
    expect(result.request_id).toBe('req-agent-1');
    expect(result.agent_id).toBe('revenue_ops_agent');
    expect(result.model_profile).toBe('fast_classifier');
    expect(result.risk_level).toBe('low');
    expect(result.human_review_required).toBe(false);
  });

  it('requires human review for refund/customer-impact requests', () => {
    const result = runAgent({
      agent_id: 'compliance_review_agent',
      objective: 'Review refund and customer impact for chargeback workflow',
    });
    expect(result.risk_level).toBe('high');
    expect(result.human_review_required).toBe(true);
    expect(result.status).toBe('requires_human_review');
  });
});
