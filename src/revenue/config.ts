import fs from 'fs';
import path from 'path';

import { LaneCatalog, OpenClawConfig, ServiceCatalog } from './types';

const repoRoot = path.resolve(__dirname, '..', '..');

function readJson<T>(relativePath: string): T {
  return JSON.parse(fs.readFileSync(path.join(repoRoot, relativePath), 'utf8')) as T;
}

export function loadLaneCatalog(): LaneCatalog {
  const catalog = readJson<LaneCatalog>('config/lanes.json');
  if (!catalog.currency || !Array.isArray(catalog.lanes)) {
    throw new Error('Invalid lane catalog: currency and lanes are required');
  }
  for (const lane of catalog.lanes) {
    if (!lane.slug || lane.price < 0 || lane.sla_hours < 1) {
      throw new Error(`Invalid lane config: ${lane.slug || 'missing-slug'}`);
    }
  }
  return catalog;
}

export function loadServiceCatalog(): ServiceCatalog {
  const catalog = readJson<ServiceCatalog>('config/services.json');
  if (!Array.isArray(catalog.services)) {
    throw new Error('Invalid service catalog: services are required');
  }
  return catalog;
}

export function loadOpenClawConfig(): OpenClawConfig {
  const config = readJson<OpenClawConfig>('config/openclaw.json');
  if (!config.engine?.default_lane || !config.engine?.default_service) {
    throw new Error('Invalid OpenClaw config: default lane and service are required');
  }
  return config;
}

export function loadTemplate(relativePath: string): string {
  const normalized = path.normalize(relativePath);
  if (normalized.startsWith('..')) {
    throw new Error('Template path cannot escape repository root');
  }
  return fs.readFileSync(path.join(repoRoot, normalized), 'utf8');
}
