const SECRET_PATTERNS: RegExp[] = [
  /\bsk_(?:live|test)_[A-Za-z0-9]+/g,
  /\bwhsec_[A-Za-z0-9]+/g,
  /\bpk_(?:live|test)_[A-Za-z0-9]+/g,
  /\bgh[pousr]_[A-Za-z0-9]+/g,
  /\bgithub_pat_[A-Za-z0-9_]+/g,
  /\bBearer\s+[A-Za-z0-9._\-+=/]+/gi,
  /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,
];

export const CUSTOMER_PII_RULES: Array<{ code: string; pattern: RegExp; valueGroup: number }> = [
  { code: 'CUSTOMER_SSN', pattern: /\b(\d{3}-\d{2}-\d{4})\b/g, valueGroup: 1 },
  {
    code: 'CUSTOMER_SSN',
    pattern: /\b(?:ssn|social\s+security(?:\s+(?:number|no\.?))?)\s*[:#]?\s*(\d{9})\b/gi,
    valueGroup: 1,
  },
  {
    code: 'CUSTOMER_DOB',
    pattern: /\b((?:0?[1-9]|1[0-2])[/-](?:0?[1-9]|[12]\d|3[01])[/-](?:19|20)\d{2})\b/g,
    valueGroup: 1,
  },
  {
    code: 'CUSTOMER_DOB',
    pattern: /\b(?:dob|date\s+of\s+birth)\s*[:#]?\s*(\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01]))\b/gi,
    valueGroup: 1,
  },
  {
    code: 'CUSTOMER_PAYMENT',
    pattern: /\b(?:credit\s+|payment\s+)?card(?:\s+(?:number|no\.?))?\s*[:#]?\s*(\d(?:[ -]?\d){12,18})\b/gi,
    valueGroup: 1,
  },
];

export function redactCustomerPiiFormats(value: string): string {
  return CUSTOMER_PII_RULES.reduce((redacted, rule) => {
    const matcher = new RegExp(rule.pattern.source, rule.pattern.flags);
    return redacted.replace(matcher, (...args: unknown[]) => {
      const match = args[0] as string;
      const sensitiveValue = args[rule.valueGroup] as string;
      return match.replace(sensitiveValue, '[REDACTED]');
    });
  }, value);
}

export function redactSecrets(value: string): string {
  return SECRET_PATTERNS.reduce((acc, pattern) => acc.replace(pattern, '[REDACTED]'), value);
}
