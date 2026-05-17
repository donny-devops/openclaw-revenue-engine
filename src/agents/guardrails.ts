import { AgentRunInput, GuardrailFinding, RiskLevel } from './types';

const SECRET_PATTERN = /(api[_-]?key|secret|token|password|whsec_|sk_live_|sk_test_)/i;
const PAYMENT_PATTERN = /(card number|cvv|cvc|payment method|bank account|chargeback|refund)/i;
const CUSTOMER_IMPACT_PATTERN = /(delete customer|modify customer|cancel subscription|refund|downgrade|customer impact)/i;

function finding(rule_id: string, severity: RiskLevel, message: string): GuardrailFinding {
  return { rule_id, severity, message };
}

export function evaluateGuardrails(input: AgentRunInput): { findings: GuardrailFinding[]; redactedText: string; redactions: string[] } {
  const text = [input.objective, input.event_summary, JSON.stringify(input.context ?? {})].join('\n');
  const findings: GuardrailFinding[] = [];
  const redactions: string[] = [];
  let redactedText = text;

  if (SECRET_PATTERN.test(text)) {
    findings.push(finding('secret_exposure', 'critical', 'Potential secret or credential reference detected.'));
    redactedText = redactedText.replace(SECRET_PATTERN, '[REDACTED_SECRET]');
    redactions.push('secret_like_value');
  }

  if (PAYMENT_PATTERN.test(text)) {
    findings.push(finding('payment_risk', 'high', 'Payment, refund, or card-related language requires review.'));
  }

  if (CUSTOMER_IMPACT_PATTERN.test(text)) {
    findings.push(finding('customer_impact', 'high', 'Customer-impacting action requires human approval.'));
  }

  return { findings, redactedText, redactions };
}

export function highestRisk(findings: GuardrailFinding[]): RiskLevel {
  if (findings.some((item) => item.severity === 'critical')) return 'critical';
  if (findings.some((item) => item.severity === 'high')) return 'high';
  if (findings.some((item) => item.severity === 'medium')) return 'medium';
  return 'low';
}
