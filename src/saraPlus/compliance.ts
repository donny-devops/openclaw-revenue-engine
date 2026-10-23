import { CUSTOMER_PII_RULES, redactCustomerPiiFormats, redactSecrets } from '../security/redact';
import { getStep, listAllowedAgentSteps, WorkflowStep } from './workflow';

export interface ActionReviewInput {
  step?: string;
  text?: string;
}

export interface ActionVerdict {
  allowed: boolean;
  step?: WorkflowStep;
  reason: string;
  violations: string[];
  redacted_input: string;
  next_allowed_steps: string[];
}

const FORBIDDEN_INSTRUCTION_RULES: Array<{ code: string; pattern: RegExp }> = [
  { code: 'CUSTOMER_SSN', pattern: /\b(?:enter|type|fill(?:\s+in)?|collect|submit|paste|key\s*in)\b[\s\w']{0,40}\b(?:ssn|social\s+security)\b/i },
  { code: 'CUSTOMER_DOB', pattern: /\b(?:enter|type|fill(?:\s+in)?|collect|submit|paste)\b[\s\w']{0,40}\b(?:dob|date\s+of\s+birth)\b/i },
  { code: 'CUSTOMER_DL', pattern: /\b(?:enter|type|fill(?:\s+in)?|collect|submit|paste)\b[\s\w']{0,40}\b(?:driver'?s?\s+license|dl\s*(?:number|#|no\.?))\b/i },
  { code: 'CUSTOMER_PIN', pattern: /\b(?:enter|type|fill(?:\s+in)?|collect|submit|paste)\b[\s\w']{0,40}\bpin\b/i },
  { code: 'CUSTOMER_PAYMENT', pattern: /\b(?:enter|type|fill(?:\s+in)?|collect|submit|take)\b[\s\w']{0,40}\b(?:credit\s+card|card\s+number|cvv|payment\s+details|routing\s+number|bank\s+account)\b/i },
  { code: 'ID_AUTH_BYPASS', pattern: /\b(?:complete|do|perform|finish)\s+id\s+auth(?:entication)?\s+(?:for|on\s+behalf\s+of)\b|\b(?:bypass|skip|workaround|avoid)\s+id\s+auth/i },
  { code: 'LOCATION_BYPASS', pattern: /\b(?:bypass|spoof|fake|disable)\b[\s\w']{0,30}\b(?:location|proximity|gps)\b/i },
  { code: 'CUSTOMER_SECURE_ENTRY', pattern: /\b(?:hands-?off|end-to-end|fully\s+automatic)\b[\s\w']{0,40}\b(?:order|sale|checkout)\b/i },
];

const NEGATED_ACTION_PREFIX = /\b(?:never|do not|don't|cannot|can't|must not)(?:\s+(?:ever|try to))?\s*$/i;
const CUSTOMER_SELF_ENTRY_TARGETS: Record<string, string> = {
  CUSTOMER_SSN: String.raw`(?:ssn|social\s+security(?:\s+(?:number|no\.?))?)`,
  CUSTOMER_DOB: String.raw`(?:dob|date\s+of\s+birth)`,
  CUSTOMER_DL: String.raw`(?:driver'?s?\s+license|dl\s*(?:number|#|no\.?))`,
  CUSTOMER_PIN: String.raw`pin`,
  CUSTOMER_PAYMENT: String.raw`(?:credit\s+card|card\s+number|cvv|payment\s+details|routing\s+number|bank\s+account)`,
};

const unique = (values: string[]): string[] => Array.from(new Set(values));

const clauseBounds = (text: string, index: number): [number, number] => {
  const before = text.slice(0, index);
  const clauseStart = Math.max(
    before.lastIndexOf('.'),
    before.lastIndexOf('!'),
    before.lastIndexOf('?'),
    before.lastIndexOf(';'),
    before.lastIndexOf('\n'),
  ) + 1;
  const after = text.slice(index);
  const clauseEndOffset = after.search(/[.!?;\n]/);
  return [clauseStart, clauseEndOffset < 0 ? text.length : index + clauseEndOffset];
};

const isCustomerSelfEntry = (text: string, match: RegExpExecArray, code: string): boolean => {
  const target = CUSTOMER_SELF_ENTRY_TARGETS[code];
  if (!target) return false;

  const [start, end] = clauseBounds(text, match.index);
  const clause = text.slice(start, end);
  const customerEntry = new RegExp(
    String.raw`\bcustomer\b[^.!?;\n]{0,40}\b(enter|type|fill(?:\s+in)?|submit|paste|key\s*in)\b[^.!?;\n]{0,35}\btheir own\b[^.!?;\n]{0,20}\b${target}\b`,
    'i',
  ).exec(clause);
  if (!customerEntry) return false;

  const actionOffset = customerEntry.index + customerEntry[0].indexOf(customerEntry[1]);
  return actionOffset === match.index - start;
};

export const redactCustomerPii = (value: string): string => {
  const withoutSecrets = redactSecrets(value);
  return redactCustomerPiiFormats(withoutSecrets);
};

export const scanRawPii = (text: string): string[] => {
  return unique(
    CUSTOMER_PII_RULES.filter((rule) => {
      rule.pattern.lastIndex = 0;
      return rule.pattern.test(text);
    }).map((rule) => rule.code),
  );
};

export const scanForbiddenInstructions = (text: string): string[] => {
  if (!text.trim()) {
    return [];
  }

  const violations: string[] = [];
  for (const rule of FORBIDDEN_INSTRUCTION_RULES) {
    const matcher = new RegExp(rule.pattern.source, rule.pattern.flags.includes('g') ? rule.pattern.flags : `${rule.pattern.flags}g`);
    let match = matcher.exec(text);
    while (match) {
      const [clauseStart] = clauseBounds(text, match.index);
      const prefix = text.slice(clauseStart, match.index);
      const allowedFraming = NEGATED_ACTION_PREFIX.test(prefix)
        || isCustomerSelfEntry(text, match, rule.code);
      if (!allowedFraming) {
        violations.push(rule.code);
        break;
      }
      match = matcher.exec(text);
    }
  }

  return unique(violations);
};

const defaultReason = (allowed: boolean, violations: string[]): string => {
  if (allowed) {
    return 'Seller-side orchestration is allowed. Stop at the secure-link handoff and never enter customer-controlled fields.';
  }
  return `Blocked by SARA Plus compliance: ${violations.join(', ')}. The customer must complete secure entry on their own device.`;
};

export const reviewSellerAction = (input: ActionReviewInput): ActionVerdict => {
  const text = input.text ?? '';
  const violations = [...scanRawPii(text), ...scanForbiddenInstructions(text)];
  const step = input.step ? getStep(input.step) : undefined;

  if (input.step && !step) {
    violations.push('UNKNOWN_STEP');
  } else if (step && !step.allowed_for_agent) {
    violations.push(step.violation_code ?? 'FORBIDDEN_STEP');
  }

  const allowed = violations.length === 0;
  return {
    allowed,
    step: step ? { ...step } : undefined,
    reason: defaultReason(allowed, unique(violations)),
    violations: unique(violations),
    redacted_input: redactCustomerPii(text),
    next_allowed_steps: listAllowedAgentSteps().map((item) => item.slug),
  };
};
