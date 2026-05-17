export interface LaneConfig {
  slug: string;
  name: string;
  price: number;
  sla_hours: number;
  capabilities: string[];
  deliverables: string[];
  max_input_chars: number;
  human_review_required: boolean;
  enabled: boolean;
}

export interface LaneCatalog {
  schema_version: string;
  currency: string;
  lanes: LaneConfig[];
}

export interface ServiceConfig {
  slug: string;
  name: string;
  description: string;
  recommended_lane: string;
  keywords: string[];
  deliverable_template: string;
  outputs: string[];
  enabled: boolean;
}

export interface ServiceCatalog {
  schema_version: string;
  services: ServiceConfig[];
}

export interface OpenClawConfig {
  schema_version: string;
  engine: {
    name: string;
    mode: string;
    default_lane: string;
    default_service: string;
    delivery_policy: string;
  };
  routing: {
    source: string;
    poll_workflow: string;
    issue_labels: string[];
    priority_labels: Record<string, string[]>;
  };
  guardrails: Record<string, boolean>;
  delivery: Record<string, boolean>;
}

export interface PaidRequestInput {
  title?: string;
  body: string;
  lane?: string;
  service?: string;
  customer_email?: string;
  source?: string;
}

export interface ClassifiedPaidRequest {
  lane: LaneConfig;
  service: ServiceConfig;
  estimated_revenue: number;
  currency: string;
  labels: string[];
  human_review_required: boolean;
  deliverable_template: string;
  requested_at: string;
  input_summary: string;
}

export interface RevenueSummary {
  currency: string;
  enabled_lanes: number;
  enabled_services: number;
  min_price: number;
  max_price: number;
  default_lane: string;
  default_service: string;
}
