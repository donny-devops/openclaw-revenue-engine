const SECRET_PATTERNS: RegExp[] = [
  /\bsk_(?:live|test)_[A-Za-z0-9]+/g,
  /\bwhsec_[A-Za-z0-9]+/g,
  /\bpk_(?:live|test)_[A-Za-z0-9]+/g,
  /\bgh[pousr]_[A-Za-z0-9]+/g,
  /\bgithub_pat_[A-Za-z0-9_]+/g,
  /\bBearer\s+[A-Za-z0-9._\-+=/]+/gi,
  /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,
];

export function redactSecrets(value: string): string {
  return SECRET_PATTERNS.reduce((acc, pattern) => acc.replace(pattern, '[REDACTED]'), value);
}
