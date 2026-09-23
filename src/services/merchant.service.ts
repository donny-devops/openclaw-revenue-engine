import { getStripe, isSimulatedStripe } from '../billing/stripeClient';

export interface MerchantRecord {
  id: string;
  clerkOrgId: string;
  clerkUserId: string;
  role: string;
  name: string;
  email: string;
  stripeCustomerId?: string;
  subscriptionId?: string;
  subscriptionTier?: string;
  subscriptionStatus?: string;
  status: 'ACTIVE' | 'PENDING' | 'SUSPENDED';
  createdAt: string;
  updatedAt: string;
}

export interface ProvisionMerchantParams {
  orgId: string;
  orgName?: string;
  userId: string;
  role: string;
  email?: string;
  name?: string;
}

export interface SyncSubscriptionParams {
  orgId?: string;
  customerId?: string;
  subscriptionId: string;
  tier?: string;
  status: string;
}

const merchantsByOrgId = new Map<string, MerchantRecord>();
const merchantsById = new Map<string, MerchantRecord>();

/**
 * Provisions an OpenClaw merchant directly from a Clerk organization membership event
 * and provisions or links a corresponding Stripe customer.
 */
export async function provisionMerchantFromOrgMembership(
  params: ProvisionMerchantParams
): Promise<MerchantRecord> {
  const existing = merchantsByOrgId.get(params.orgId);
  const now = new Date().toISOString();

  let stripeCustomerId = existing?.stripeCustomerId;

  if (!stripeCustomerId) {
    if (isSimulatedStripe()) {
      stripeCustomerId = `cus_sim_${params.orgId.replace(/[^a-zA-Z0-9]/g, '').slice(-12)}`;
    } else {
      try {
        const stripe = getStripe();
        const customer = await stripe.customers.create({
          email: params.email,
          name: params.name || params.orgName || `Org-${params.orgId}`,
          metadata: {
            clerkOrgId: params.orgId,
            clerkUserId: params.userId,
            role: params.role,
          },
        });
        stripeCustomerId = customer.id;
      } catch (err) {
        console.warn(`[MerchantService] Stripe customer creation fallback:`, err);
        stripeCustomerId = `cus_fallback_${Date.now()}`;
      }
    }
  }

  const merchant: MerchantRecord = {
    id: existing?.id ?? `merch_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    clerkOrgId: params.orgId,
    clerkUserId: params.userId,
    role: params.role,
    name: params.name || params.orgName || `Merchant-${params.orgId}`,
    email: params.email || `${params.userId}@clerk.merchant`,
    stripeCustomerId,
    subscriptionTier: existing?.subscriptionTier ?? 'standard',
    subscriptionStatus: existing?.subscriptionStatus ?? 'active',
    status: 'ACTIVE',
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };

  merchantsByOrgId.set(params.orgId, merchant);
  merchantsById.set(merchant.id, merchant);

  console.log(`[MerchantService] Provisioned merchant ${merchant.id} for Clerk Org ${params.orgId} (Stripe Customer: ${stripeCustomerId})`);
  return merchant;
}

/**
 * Activates or syncs a merchant's subscription from Clerk/Stripe subscription events.
 */
export async function syncMerchantSubscription(
  params: SyncSubscriptionParams
): Promise<MerchantRecord | undefined> {
  let merchant: MerchantRecord | undefined;

  if (params.orgId) {
    merchant = merchantsByOrgId.get(params.orgId);
  }

  if (!merchant && params.customerId) {
    for (const m of merchantsByOrgId.values()) {
      if (m.stripeCustomerId === params.customerId) {
        merchant = m;
        break;
      }
    }
  }

  if (!merchant) {
    // If merchant does not exist yet, provision an initial placeholder merchant record
    const targetOrgId = params.orgId || `org_${params.customerId || Date.now()}`;
    merchant = await provisionMerchantFromOrgMembership({
      orgId: targetOrgId,
      userId: `user_sub_${Date.now()}`,
      role: 'org:admin',
      name: `Subscribed Merchant ${targetOrgId}`,
    });
  }

  merchant.subscriptionId = params.subscriptionId;
  merchant.subscriptionTier = params.tier || merchant.subscriptionTier || 'pro';
  merchant.subscriptionStatus = params.status;
  merchant.updatedAt = new Date().toISOString();

  merchantsByOrgId.set(merchant.clerkOrgId, merchant);
  merchantsById.set(merchant.id, merchant);

  console.log(`[MerchantService] Updated subscription for merchant ${merchant.id}: status=${merchant.subscriptionStatus}, tier=${merchant.subscriptionTier}`);
  return merchant;
}

export function getMerchant(id: string): MerchantRecord | undefined {
  return merchantsById.get(id);
}

export function findMerchantByOrgId(orgId: string): MerchantRecord | undefined {
  return merchantsByOrgId.get(orgId);
}

export function listMerchants(): MerchantRecord[] {
  return Array.from(merchantsByOrgId.values());
}

export function resetMerchantStore(): void {
  merchantsByOrgId.clear();
  merchantsById.clear();
}
