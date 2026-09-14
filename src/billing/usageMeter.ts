import { newId } from '../lib/ids';
import { UsageEvent, UsageSummary } from './types';

const events: UsageEvent[] = [];
const idempotencyIndex = new Map<string, UsageEvent>();

const buildIdempotencyKey = (tenantId: string, idempotencyKey: string): string =>
  `${tenantId}::${idempotencyKey}`;

const clone = (event: UsageEvent): UsageEvent => ({
  ...event,
  metadata: { ...event.metadata },
});

export function resetUsageMeter(): void {
  events.length = 0;
  idempotencyIndex.clear();
}

export function recordUsageEvent(input: {
  tenant_id: string;
  metric_type: string;
  quantity: number;
  unit?: string;
  idempotency_key?: string;
  metadata?: Record<string, unknown>;
}): UsageEvent {
  if (!input.tenant_id.trim()) {
    throw new Error('tenant_id is required');
  }
  if (!Number.isFinite(input.quantity) || input.quantity < 0) {
    throw new Error('quantity must be a non-negative number');
  }

  const metric = input.metric_type.trim();
  if (!metric) {
    throw new Error('metric_type is required');
  }

  if (input.idempotency_key) {
    const existing = idempotencyIndex.get(buildIdempotencyKey(input.tenant_id, input.idempotency_key));
    if (existing) return clone(existing);
  }

  const event: UsageEvent = {
    id: newId('use'),
    tenant_id: input.tenant_id,
    metric_type: metric,
    quantity: input.quantity,
    unit: input.unit ?? 'count',
    idempotency_key: input.idempotency_key,
    recorded_at: new Date().toISOString(),
    metadata: input.metadata ?? {},
  };

  events.push(event);
  if (event.idempotency_key) {
    idempotencyIndex.set(buildIdempotencyKey(event.tenant_id, event.idempotency_key), event);
  }
  return clone(event);
}

export function listUsageEvents(tenantId?: string): UsageEvent[] {
  return events
    .filter((event) => !tenantId || event.tenant_id === tenantId)
    .map(clone);
}

export function getUsageSummary(tenantId?: string): UsageSummary {
  const filtered = listUsageEvents(tenantId);
  const totals_by_metric: Record<string, number> = {};
  for (const event of filtered) {
    totals_by_metric[event.metric_type] = (totals_by_metric[event.metric_type] ?? 0) + event.quantity;
  }
  return {
    tenant_id: tenantId,
    events: filtered.length,
    totals_by_metric,
  };
}
