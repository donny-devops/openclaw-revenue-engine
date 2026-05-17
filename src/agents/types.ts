export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';
export type AgentStatus = 'completed' | 'blocked' | 'requires_human_review';

export interface AgentManifest {
  schema_version: string;
  agent_id: string;
  name: string;
  description: string;
  model_profile: string;
  allowed_tools: string[];
  inputs: string[];
  outputs: string[];
  guardrails: Record<string, boolean>;
  success_criteria: string[];
}

export interface ModelProfile {
  purpose: string;
  preferred_model_family: string;
  temperature: number;
  max_output_tokens: number;
  requires_citations: boolean;
  human_review_required: boolean;
}

export interface ModelRoutingRule {
  match: string;
  profile: string;
}

export interface ModelRoutingPolicy {
  schema_version: string;
  default_profile: string;
  profiles: Record<string, ModelProfile>;
  routing_rules: ModelRoutingRule[];
}

export interface AgentRunInput {
  request_id?: string;
  agent_id: string;
  objective: string;
  context?: Record<string, unknown>;
  event_summary?: string;
}

export interface GuardrailFinding {
  rule_id: string;
  severity: RiskLevel;
  message: string;
}

export interface AgentRunResult {
  request_id: string;
  agent_id: string;
  agent_name: string;
  model_profile: string;
  status: AgentStatus;
  risk_level: RiskLevel;
  summary: string;
  recommended_actions: string[];
  findings: GuardrailFinding[];
  redactions: string[];
  human_review_required: boolean;
  telemetry: {
    input_chars: number;
    output_actions: number;
    guardrail_findings: number;
  };
}
