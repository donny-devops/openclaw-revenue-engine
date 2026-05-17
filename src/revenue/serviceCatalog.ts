import { loadLaneCatalog, loadOpenClawConfig, loadServiceCatalog, loadTemplate } from './config';
import { ClassifiedPaidRequest, LaneConfig, PaidRequestInput, RevenueSummary, ServiceConfig } from './types';

const enabledLanes = (): LaneConfig[] => loadLaneCatalog().lanes.filter((lane) => lane.enabled);

const enabledServices = (): ServiceConfig[] => loadServiceCatalog().services.filter((service) => service.enabled);

export const listRevenueLanes = (): LaneConfig[] => enabledLanes();

export const listRevenueServices = (): ServiceConfig[] => enabledServices();

export const getLane = (slug: string): LaneConfig => {
  const lane = enabledLanes().find((item) => item.slug === slug);
  if (!lane) {
    throw new Error(`Unknown or disabled lane: ${slug}`);
  }
  return lane;
};

export const getService = (slug: string): ServiceConfig => {
  const service = enabledServices().find((item) => item.slug === slug);
  if (!service) {
    throw new Error(`Unknown or disabled service: ${slug}`);
  }
  return service;
};

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const keywordMatches = (keyword: string, haystack: string): boolean => {
  const normalizedKeyword = keyword.toLowerCase().trim();
  if (normalizedKeyword.length <= 2) {
    return new RegExp(`(^|\\W)${escapeRegExp(normalizedKeyword)}($|\\W)`, 'i').test(haystack);
  }
  return haystack.includes(normalizedKeyword);
};

const keywordScore = (service: ServiceConfig, haystack: string): number => {
  return service.keywords.reduce((score, keyword) => {
    const normalizedKeyword = keyword.toLowerCase().trim();
    return keywordMatches(normalizedKeyword, haystack) ? score + normalizedKeyword.length : score;
  }, 0);
};

const inferService = (input: PaidRequestInput): ServiceConfig => {
  if (input.service) return getService(input.service);

  const openclaw = loadOpenClawConfig();
  const haystack = `${input.title ?? ''}\n${input.body}`.toLowerCase();
  const ranked = enabledServices()
    .map((service) => ({ service, score: keywordScore(service, haystack) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);

  return ranked[0]?.service ?? getService(openclaw.engine.default_service);
};

const inferLane = (input: PaidRequestInput, service: ServiceConfig): LaneConfig => {
  if (input.lane) return getLane(input.lane);
  return getLane(service.recommended_lane);
};

const summarizeInput = (input: PaidRequestInput): string => {
  const text = `${input.title ?? ''} ${input.body}`.replace(/\s+/g, ' ').trim();
  return text.length > 280 ? `${text.slice(0, 277)}...` : text;
};

const inputLength = (input: PaidRequestInput): number => `${input.title ?? ''}\n${input.body}`.length;

export const classifyPaidRequest = (input: PaidRequestInput): ClassifiedPaidRequest => {
  if (!input.body.trim()) {
    throw new Error('Paid request body is required');
  }

  const openclaw = loadOpenClawConfig();
  const service = inferService(input);
  const lane = inferLane(input, service);
  if (inputLength(input) > lane.max_input_chars) {
    throw new Error(`Paid request exceeds ${lane.slug} lane max_input_chars limit`);
  }

  const labels = [
    ...openclaw.routing.issue_labels,
    ...(openclaw.routing.priority_labels[lane.slug] ?? []),
    `service:${service.slug}`,
  ];

  return {
    lane,
    service,
    estimated_revenue: lane.price,
    currency: loadLaneCatalog().currency,
    labels: Array.from(new Set(labels)),
    human_review_required: lane.human_review_required || openclaw.guardrails.require_human_review,
    deliverable_template: loadTemplate(service.deliverable_template),
    requested_at: new Date().toISOString(),
    input_summary: summarizeInput(input),
  };
};

export const getRevenueSummary = (): RevenueSummary => {
  const lanes = enabledLanes();
  const services = enabledServices();
  const openclaw = loadOpenClawConfig();
  const prices = lanes.map((lane) => lane.price);

  return {
    currency: loadLaneCatalog().currency,
    enabled_lanes: lanes.length,
    enabled_services: services.length,
    min_price: prices.length > 0 ? Math.min(...prices) : 0,
    max_price: prices.length > 0 ? Math.max(...prices) : 0,
    default_lane: openclaw.engine.default_lane,
    default_service: openclaw.engine.default_service,
  };
};
