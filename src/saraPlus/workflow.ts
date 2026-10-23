export type WorkflowActor = 'seller_agent' | 'customer' | 'sara_plus' | 'official_id_channel';
export type WorkflowSensitivity = 'nonsensitive' | 'handoff' | 'customer_secure' | 'forbidden';
export type WaitingOn = 'seller' | 'customer' | 'id_auth' | 'none';

export interface WorkflowStep {
  slug: string;
  title: string;
  actor: WorkflowActor;
  sensitivity: WorkflowSensitivity;
  allowed_for_agent: boolean;
  waiting_on: WaitingOn;
  prompt: string;
  ui_capture: string;
  violation_code?: string;
}

export const SARA_PLUS_SKILL_PATH = 'skills/sara-plus-touchless/SKILL.md';

export const WORKFLOW_STEPS: WorkflowStep[] = [
  {
    slug: 'seller_login',
    title: 'Open the seller SARA Plus web session',
    actor: 'seller_agent',
    sensitivity: 'nonsensitive',
    allowed_for_agent: true,
    waiting_on: 'seller',
    prompt: 'Use the seller’s own authorized session. Do not share or store credentials in chat.',
    ui_capture: 'Record the live login screen name and success indicator from the seller UI.',
  },
  {
    slug: 'new_account_start',
    title: 'Start AT&T mobile new-account / touchless flow',
    actor: 'seller_agent',
    sensitivity: 'nonsensitive',
    allowed_for_agent: true,
    waiting_on: 'seller',
    prompt: 'Choose the official touchless / new-account path. Do not look for workarounds around ID auth.',
    ui_capture: 'Record the exact new-account and touchless control labels.',
  },
  {
    slug: 'nonsensitive_customer_profile',
    title: 'Fill non-sensitive profile fields',
    actor: 'seller_agent',
    sensitivity: 'nonsensitive',
    allowed_for_agent: true,
    waiting_on: 'seller',
    prompt: 'Name, service address, and similar public profile fields only.',
    ui_capture: 'Record field labels for name, address, and contact that are safe for the seller side.',
  },
  {
    slug: 'service_availability',
    title: 'Check service availability',
    actor: 'seller_agent',
    sensitivity: 'nonsensitive',
    allowed_for_agent: true,
    waiting_on: 'seller',
    prompt: 'Run the availability check for the service address already entered.',
    ui_capture: 'Record the availability-check button and result panel labels.',
  },
  {
    slug: 'plan_selection',
    title: 'Select the mobile plan',
    actor: 'seller_agent',
    sensitivity: 'nonsensitive',
    allowed_for_agent: true,
    waiting_on: 'seller',
    prompt: 'Build the plan from seller-side catalog options. Prompt the seller at pricing or eligibility forks.',
    ui_capture: 'Record plan-build screen and selection control labels.',
  },
  {
    slug: 'device_selection',
    title: 'Select the device',
    actor: 'seller_agent',
    sensitivity: 'nonsensitive',
    allowed_for_agent: true,
    waiting_on: 'seller',
    prompt: 'Choose device and fulfillment options that do not require customer-secure data.',
    ui_capture: 'Record device-selection and fulfillment control labels.',
  },
  {
    slug: 'trigger_credit_check',
    title: 'Trigger credit check via secure customer entry',
    actor: 'seller_agent',
    sensitivity: 'handoff',
    allowed_for_agent: true,
    waiting_on: 'customer',
    prompt: 'Start the official credit-check step, then stop. The customer enters identity data on their device.',
    ui_capture: 'Record the credit-check trigger and the control that sends the secure link.',
  },
  {
    slug: 'trigger_secure_link',
    title: 'Send the SARA Plus secure link',
    actor: 'seller_agent',
    sensitivity: 'handoff',
    allowed_for_agent: true,
    waiting_on: 'customer',
    prompt: 'Trigger the official send-secure-link / touchless handoff. The link itself comes from SARA Plus.',
    ui_capture: 'Record the send-link button, channel picker (email/text), and confirmation text.',
  },
  {
    slug: 'draft_handoff_message',
    title: 'Draft the accompanying seller message',
    actor: 'seller_agent',
    sensitivity: 'handoff',
    allowed_for_agent: true,
    waiting_on: 'customer',
    prompt: 'Draft SMS/email/Telegram copy that tells the customer to open the SARA Plus link on their device. Never paste SSN, DOB, PIN, or card data into that message.',
    ui_capture: 'No SARA control required. Keep the actual secure URL out of agent-generated copy unless the seller pastes the official link.',
  },
  {
    slug: 'monitor_order_status',
    title: 'Monitor order status',
    actor: 'seller_agent',
    sensitivity: 'nonsensitive',
    allowed_for_agent: true,
    waiting_on: 'customer',
    prompt: 'Watch seller-visible status only. Do not open the customer secure form.',
    ui_capture: 'Record the status field and waiting-on-customer indicators.',
  },
  {
    slug: 'resend_secure_link',
    title: 'Resend the secure link if the customer closed the browser',
    actor: 'seller_agent',
    sensitivity: 'handoff',
    allowed_for_agent: true,
    waiting_on: 'customer',
    prompt: 'Use the official resend action. Remind the customer to keep their browser open.',
    ui_capture: 'Record the resend-link control and any cooldown messaging.',
  },
  {
    slug: 'prompt_id_auth',
    title: 'Prompt official ID authentication',
    actor: 'official_id_channel',
    sensitivity: 'handoff',
    allowed_for_agent: true,
    waiting_on: 'id_auth',
    prompt: 'ID authentication is mandatory. Use the automated link or a manual call with the transaction ID. No workarounds.',
    ui_capture: 'Record how the transaction ID is displayed and the official ID-auth launch control.',
  },
  {
    slug: 'advance_after_customer',
    title: 'Advance after the customer finishes secure steps',
    actor: 'seller_agent',
    sensitivity: 'nonsensitive',
    allowed_for_agent: true,
    waiting_on: 'seller',
    prompt: 'Continue only after SARA Plus shows the customer completed consent, identity, and payment on their device.',
    ui_capture: 'Record the post-customer continue/submit control and completion banner.',
  },
  {
    slug: 'seller_followup',
    title: 'Remind the seller to follow up',
    actor: 'seller_agent',
    sensitivity: 'nonsensitive',
    allowed_for_agent: true,
    waiting_on: 'seller',
    prompt: 'Notify the seller on Telegram/Slack/Discord when the link is waiting or the customer has finished.',
    ui_capture: 'No SARA control required.',
  },
  {
    slug: 'status_report',
    title: 'Pull a simple pending-order report',
    actor: 'seller_agent',
    sensitivity: 'nonsensitive',
    allowed_for_agent: true,
    waiting_on: 'none',
    prompt: 'Summarize which orders are waiting on the customer, ID auth, or the seller. No raw customer secrets.',
    ui_capture: 'Record any seller-visible queue or order-list labels.',
  },
  {
    slug: 'enter_ssn',
    title: 'Enter customer SSN',
    actor: 'customer',
    sensitivity: 'forbidden',
    allowed_for_agent: false,
    waiting_on: 'customer',
    prompt: 'Blocked. The customer enters SSN on the secure link.',
    ui_capture: 'Do not automate this screen.',
    violation_code: 'CUSTOMER_SSN',
  },
  {
    slug: 'enter_dob',
    title: 'Enter customer date of birth',
    actor: 'customer',
    sensitivity: 'forbidden',
    allowed_for_agent: false,
    waiting_on: 'customer',
    prompt: 'Blocked. The customer enters DOB on their device.',
    ui_capture: 'Do not automate this screen.',
    violation_code: 'CUSTOMER_DOB',
  },
  {
    slug: 'enter_dl',
    title: 'Enter customer driver license',
    actor: 'customer',
    sensitivity: 'forbidden',
    allowed_for_agent: false,
    waiting_on: 'customer',
    prompt: 'Blocked. Driver license entry stays on the customer secure form.',
    ui_capture: 'Do not automate this screen.',
    violation_code: 'CUSTOMER_DL',
  },
  {
    slug: 'enter_pin',
    title: 'Enter customer PIN',
    actor: 'customer',
    sensitivity: 'forbidden',
    allowed_for_agent: false,
    waiting_on: 'customer',
    prompt: 'Blocked. PIN entry is customer-controlled.',
    ui_capture: 'Do not automate this screen.',
    violation_code: 'CUSTOMER_PIN',
  },
  {
    slug: 'enter_payment',
    title: 'Enter customer payment details',
    actor: 'customer',
    sensitivity: 'forbidden',
    allowed_for_agent: false,
    waiting_on: 'customer',
    prompt: 'Blocked. Payment details stay on the customer device.',
    ui_capture: 'Do not automate this screen.',
    violation_code: 'CUSTOMER_PAYMENT',
  },
  {
    slug: 'complete_id_auth',
    title: 'Complete ID authentication on the customer’s behalf',
    actor: 'customer',
    sensitivity: 'forbidden',
    allowed_for_agent: false,
    waiting_on: 'id_auth',
    prompt: 'Blocked. ID auth is mandatory and must use the official link or call. No workarounds.',
    ui_capture: 'Do not automate or bypass this screen.',
    violation_code: 'ID_AUTH_BYPASS',
  },
  {
    slug: 'bypass_id_auth',
    title: 'Skip or workaround ID authentication',
    actor: 'customer',
    sensitivity: 'forbidden',
    allowed_for_agent: false,
    waiting_on: 'id_auth',
    prompt: 'Blocked. There is no compliant shortcut around ID authentication.',
    ui_capture: 'Do not search for alternate paths.',
    violation_code: 'ID_AUTH_BYPASS',
  },
  {
    slug: 'location_services_bypass',
    title: 'Bypass iPad location / proximity rules',
    actor: 'seller_agent',
    sensitivity: 'forbidden',
    allowed_for_agent: false,
    waiting_on: 'seller',
    prompt: 'Blocked. Location-services and proximity rules still apply on the iPad app path.',
    ui_capture: 'Do not automate location spoofing.',
    violation_code: 'LOCATION_BYPASS',
  },
];

export const getWorkflow = (): WorkflowStep[] => WORKFLOW_STEPS.map((step) => ({ ...step }));

export const getStep = (slug: string): WorkflowStep | undefined =>
  WORKFLOW_STEPS.find((step) => step.slug === slug);

export const listAllowedAgentSteps = (): WorkflowStep[] =>
  WORKFLOW_STEPS.filter((step) => step.allowed_for_agent).map((step) => ({ ...step }));

export const listForbiddenSteps = (): WorkflowStep[] =>
  WORKFLOW_STEPS.filter((step) => !step.allowed_for_agent).map((step) => ({ ...step }));
