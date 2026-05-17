import { AgentRunInput, AgentRunResult } from './types';

export interface AgentAuditRecord {
  request_id: string;
  agent_id: string;
  agent_name: string;
  model_profile: string;
  risk_level: AgentRunResult['risk_level'];
  status: AgentRunResult['status'];
  human_review_required: boolean;
  findings_count: number;
  redactions_count: number;
  mcp_plan_steps: number;
  objective: string;
  event_summary?: string;
  created_at: string;
  result: AgentRunResult;
}

const MAX_AUDIT_RECORDS = 500;
const auditRecords: AgentAuditRecord[] = [];

export function recordAgentRun(input: AgentRunInput, result: AgentRunResult): AgentAuditRecord {
  const record: AgentAuditRecord = {
    request_id: result.request_id,
    agent_id: result.agent_id,
    agent_name: result.agent_name,
    model_profile: result.model_profile,
    risk_level: result.risk_level,
    status: result.status,
    human_review_required: result.human_review_required,
    findings_count: result.findings.length,
    redactions_count: result.redactions.length,
    mcp_plan_steps: result.mcp_plan.length,
    objective: input.objective,
    event_summary: input.event_summary,
    created_at: new Date().toISOString(),
    result,
  };

  auditRecords.unshift(record);
  if (auditRecords.length > MAX_AUDIT_RECORDS) {
    auditRecords.length = MAX_AUDIT_RECORDS;
  }

  return record;
}

export function listAgentRuns(limit = 50): AgentAuditRecord[] {
  return auditRecords.slice(0, Math.max(0, Math.min(limit, MAX_AUDIT_RECORDS)));
}

export function getAgentRun(requestId: string): AgentAuditRecord | undefined {
  return auditRecords.find((record) => record.request_id === requestId);
}

export function clearAgentAuditLogForTests(): void {
  auditRecords.length = 0;
}
