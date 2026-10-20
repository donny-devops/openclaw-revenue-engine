import { newId } from '../lib/ids';
import { redactCustomerPii, reviewSellerAction } from './compliance';
import { WaitingOn } from './workflow';

export type SaraPlusOrderStatus =
  | 'seller_prep'
  | 'awaiting_secure_link'
  | 'link_sent'
  | 'awaiting_customer'
  | 'customer_complete'
  | 'seller_advance'
  | 'blocked_compliance';

export interface SaraPlusOrder {
  id: string;
  customer_display_name?: string;
  order_ref?: string;
  status: SaraPlusOrderStatus;
  last_step: string;
  waiting_on: WaitingOn;
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface CreateSaraPlusOrderInput {
  customer_display_name?: string;
  order_ref?: string;
  status?: SaraPlusOrderStatus;
  last_step?: string;
  waiting_on?: WaitingOn;
  notes?: string;
}

export interface UpdateSaraPlusOrderInput {
  customer_display_name?: string;
  order_ref?: string;
  status?: SaraPlusOrderStatus;
  last_step?: string;
  waiting_on?: WaitingOn;
  notes?: string;
}

const orders = new Map<string, SaraPlusOrder>();

const nowIso = (): string => new Date().toISOString();

const clone = (order: SaraPlusOrder): SaraPlusOrder => ({ ...order });

const assertCompliantText = (value: string | undefined, field: string): string => {
  if (!value) return '';
  const verdict = reviewSellerAction({ text: value });
  if (!verdict.allowed) {
    throw new Error(`SARA Plus compliance blocked ${field}: ${verdict.violations.join(', ')}`);
  }
  return redactCustomerPii(value);
};

export const resetSaraPlusOrders = (): void => {
  orders.clear();
};

export const createSaraPlusOrder = (input: CreateSaraPlusOrderInput = {}): SaraPlusOrder => {
  const timestamp = nowIso();
  const order: SaraPlusOrder = {
    id: newId('sara'),
    customer_display_name: assertCompliantText(input.customer_display_name, 'customer_display_name') || undefined,
    order_ref: input.order_ref?.trim() || undefined,
    status: input.status ?? 'seller_prep',
    last_step: input.last_step ?? 'seller_login',
    waiting_on: input.waiting_on ?? 'seller',
    notes: assertCompliantText(input.notes, 'notes'),
    created_at: timestamp,
    updated_at: timestamp,
  };
  orders.set(order.id, order);
  return clone(order);
};

export const getSaraPlusOrder = (id: string): SaraPlusOrder | undefined => {
  const order = orders.get(id);
  return order ? clone(order) : undefined;
};

export const listSaraPlusOrders = (): SaraPlusOrder[] =>
  Array.from(orders.values()).map(clone);

export const updateSaraPlusOrder = (id: string, input: UpdateSaraPlusOrderInput): SaraPlusOrder => {
  const existing = orders.get(id);
  if (!existing) {
    throw new Error(`Unknown SARA Plus order: ${id}`);
  }

  const updated: SaraPlusOrder = {
    ...existing,
    customer_display_name: input.customer_display_name !== undefined
      ? assertCompliantText(input.customer_display_name, 'customer_display_name') || undefined
      : existing.customer_display_name,
    order_ref: input.order_ref !== undefined ? input.order_ref.trim() || undefined : existing.order_ref,
    status: input.status ?? existing.status,
    last_step: input.last_step ?? existing.last_step,
    waiting_on: input.waiting_on ?? existing.waiting_on,
    notes: input.notes !== undefined ? assertCompliantText(input.notes, 'notes') : existing.notes,
    updated_at: nowIso(),
  };
  orders.set(id, updated);
  return clone(updated);
};

const ORDER_STATUSES: SaraPlusOrderStatus[] = [
  'seller_prep',
  'awaiting_secure_link',
  'link_sent',
  'awaiting_customer',
  'customer_complete',
  'seller_advance',
  'blocked_compliance',
];

const WAITING_ON: WaitingOn[] = ['seller', 'customer', 'id_auth', 'none'];

export const parseOrderStatus = (value?: string): SaraPlusOrderStatus | undefined =>
  ORDER_STATUSES.includes(value as SaraPlusOrderStatus) ? value as SaraPlusOrderStatus : undefined;

export const parseWaitingOn = (value?: string): WaitingOn | undefined =>
  WAITING_ON.includes(value as WaitingOn) ? value as WaitingOn : undefined;

export const listOrdersNeedingFollowUp = (
  nowMs = Date.now(),
  staleMs?: number,
): SaraPlusOrder[] => {
  const threshold = staleMs ?? 30 * 60 * 1000;
  const waitingStatuses: SaraPlusOrderStatus[] = ['link_sent', 'awaiting_customer'];
  return listSaraPlusOrders().filter((order) => {
    if (order.waiting_on !== 'customer' && !waitingStatuses.includes(order.status)) {
      return false;
    }
    return nowMs - Date.parse(order.updated_at) >= threshold;
  });
};
