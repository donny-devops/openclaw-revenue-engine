import fs from 'fs';
import path from 'path';

import { LaneCatalog, LaneConfig, OpenClawConfig, ServiceCatalog } from './types';

const repoRoot = path.resolve(__dirname, '..', '..');

let laneCatalogCache: LaneCatalog | undefined;
let serviceCatalogCache: ServiceCatalog | undefined;
let openClawConfigCache: OpenClawConfig | undefined;
const templateCache = new Map<string, string>();

const readJson = <T>(relativePath: string): T => {
  return JSON.parse(fs.readFileSync(path.join(repoRoot, relativePath), 'utf8')) as T;
};

const validateLane = (lane: LaneConfig): void => {
  if (
    !lane.slug ||
    typeof lane.price !== 'number' ||
    lane.price < 0 ||
    typeof lane.sla_hours !== 'number' ||
    lane.sla_hours < 1 ||
    !Array.isArray(lane.capabilities) ||
    !Array.isArray(lane.deliverables)
  ) {
    throw new Error(`Invalid lane config: ${lane.slug || 'missing-slug'}`);
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

  serviceCatalogCache = catalog;
  return serviceCatalogCache;
};

export const loadOpenClawConfig = (): OpenClawConfig => {
  if (openClawConfigCache) return openClawConfigCache;

  const config = readJson<OpenClawConfig>('config/openclaw.json');
  if (!config.engine?.default_lane || !config.engine?.default_service) {
    throw new Error('Invalid OpenClaw config: default lane and service are required');
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
