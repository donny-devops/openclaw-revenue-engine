import { reviewSellerAction } from './compliance';

export type HandoffChannel = 'sms' | 'email' | 'telegram' | 'slack' | 'discord';

const HANDOFF_CHANNELS: HandoffChannel[] = ['sms', 'email', 'telegram', 'slack', 'discord'];

export const parseHandoffChannel = (value?: string): HandoffChannel | undefined =>
  HANDOFF_CHANNELS.includes(value as HandoffChannel) ? value as HandoffChannel : undefined;

export interface HandoffDraftInput {
  channel?: HandoffChannel;
  customer_first_name?: string;
  seller_name?: string;
}

export interface HandoffDraft {
  channel: HandoffChannel;
  subject?: string;
  body: string;
  includes_secure_link: false;
  compliance_note: string;
}

const DEFAULT_COMPLIANCE_NOTE =
  'The actual secure link comes from SARA Plus. Do not ask the customer to send SSN, DOB, PIN, driver license, or payment details to the seller or agent.';

export const draftHandoffMessage = (input: HandoffDraftInput = {}): HandoffDraft => {
  const greeting = input.customer_first_name?.trim() || 'there';
  const seller = input.seller_name?.trim();
  const channel = input.channel ?? 'sms';
  const identity = seller ? ` — ${seller}` : '';

  const scanSource = `${greeting} ${seller ?? ''}`;
  const verdict = reviewSellerAction({ text: scanSource, step: 'draft_handoff_message' });
  if (!verdict.allowed) {
    throw new Error(`SARA Plus compliance blocked handoff draft: ${verdict.violations.join(', ')}`);
  }

  const body = [
    `Hi ${greeting}, your SARA Plus secure link is ready.`,
    'Open it on your own phone or computer, complete consent plus your date of birth, ID, and payment there, and keep that browser open until you see confirmation.',
    'I cannot collect those details for you or finish ID authentication on your behalf.',
    seller ? `Reply here if the link did not arrive and I will resend it from SARA Plus${identity}.` : 'Reply here if the link did not arrive and I will resend it from SARA Plus.',
  ].join(' ');

  return {
    channel,
    subject: channel === 'email' ? 'Complete your SARA Plus secure steps on your device' : undefined,
    body,
    includes_secure_link: false,
    compliance_note: DEFAULT_COMPLIANCE_NOTE,
  };
};
