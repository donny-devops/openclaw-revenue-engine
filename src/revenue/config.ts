import fs from 'fs';
import path from 'path';

import { LaneCatalog, LaneConfig, OpenClawConfig, ServiceCatalog, ServiceConfig } from './types';

const repoRoot = path.resolve(__dirname, '..', '..');

let laneCatalogCache: LaneCatalog | undefined;
let serviceCatalogCache: ServiceCatalog | undefined;
let openClawConfigCache: OpenClawConfig | undefined;
const templateCache = new Map<string, string>();

const readJson = <T>(relativePath: string): T => {
  return JSON.parse(fs.readFileSync(path.join(repoRoot, relativePath), 'utf8')) as T;
};

const hasText = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;
const hasNumberAtLeast = (value: unknown, minimum: number): value is number => typeof value === 'number' && Number.isFinite(value) && value >= minimum;
const hasStringArray = (value: unknown): value is string[] => Array.isArray(value) && value.every(hasText);
const hasBoolean = (value: unknown): value is boolean => typeof value === 'boolean';

const validateLane = (lane: LaneConfig): void => {
  const validations = [
    hasText(lane.slug),
    hasText(lane.name),
    hasNumberAtLeast(lane.price, 0),
    hasNumberAtLeast(lane.sla_hours, 1),
    hasStringArray(lane.capabilities),
    hasStringArray(lane.deliverables),
    hasNumberAtLeast(lane.max_input_chars, 1),
    hasBoolean(lane.human_review_required),
    hasBoolean(lane.enabled),
  ];

  if (validations.some((valid) => !valid)) {
    throw new Error(`Invalid lane config: ${lane.slug || 'missing-slug'}`);
  }
};

const validateService = (service: ServiceConfig): void => {
  const validations = [
    hasText(service.slug),
    hasText(service.name),
    hasText(service.description),
    hasText(service.recommended_lane),
    hasStringArray(service.keywords),
    hasText(service.deliverable_template),
    hasStringArray(service.outputs),
    hasBoolean(service.enabled),
  ];

  if (validations.some((valid) => !valid)) {
    throw new Error(`Invalid service config: ${service.slug || 'missing-slug'}`);
  }
};

export const loadLaneCatalog = (): LaneCatalog => {
  if (laneCatalogCache) return laneCatalogCache;

  const catalog = readJson<LaneCatalog>('config/lanes.json');
  if (!catalog.currency || !Array.isArray(catalog.lanes)) {
    throw new Error('Invalid lane catalog: currency and lanes are required');
  }

  catalog.lanes.forEach(validateLane);
  laneCatalogCache = catalog;
  return laneCatalogCache;
};

export const loadServiceCatalog = (): ServiceCatalog => {
  if (serviceCatalogCache) return serviceCatalogCache;

  const catalog = readJson<ServiceCatalog>('config/services.json');
  if (!Array.isArray(catalog.services)) {
    throw new Error('Invalid service catalog: services are required');
  }

  catalog.services.forEach(validateService);
  serviceCatalogCache = catalog;
  return serviceCatalogCache;
};

export const loadOpenClawConfig = (): OpenClawConfig => {
  if (openClawConfigCache) return openClawConfigCache;

  const config = readJson<OpenClawConfig>('config/openclaw.json');
  const validRouting = Array.isArray(config.routing?.issue_labels) && typeof config.routing?.priority_labels === 'object';
  const validGuardrails = typeof config.guardrails?.require_human_review === 'boolean';

  if (!config.engine?.default_lane || !config.engine?.default_service || !validRouting || !validGuardrails) {
    throw new Error('Invalid OpenClaw config: engine, routing, and guardrails are required');
  }

  openClawConfigCache = config;
  return openClawConfigCache;
};

export const loadTemplate = (relativePath: string): string => {
  const normalized = path.normalize(relativePath);
  if (normalized.startsWith('..')) {
    throw new Error('Template path cannot escape repository root');
  }

  const cached = templateCache.get(normalized);
  if (cached) return cached;

  const template = fs.readFileSync(path.join(repoRoot, normalized), 'utf8');
  templateCache.set(normalized, template);
  return template;
};
