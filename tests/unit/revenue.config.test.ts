import fs from 'fs';

type RevenueConfigModule = typeof import('../../src/revenue/config');

const loadConfigModule = (): RevenueConfigModule => {
  let loaded!: RevenueConfigModule;
  jest.isolateModules(() => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    loaded = require('../../src/revenue/config') as RevenueConfigModule;
  });
  return loaded;
};

const actualReadFileSync = fs.readFileSync.bind(fs);

const mockConfigFile = (relativePath: string, value: unknown): void => {
  jest.spyOn(fs, 'readFileSync').mockImplementation(((filePath: fs.PathOrFileDescriptor, options?: { encoding?: BufferEncoding | null } | BufferEncoding | null) => {
    const normalized = String(filePath).replace(/\\/g, '/');
    if (normalized.endsWith(relativePath)) {
      return JSON.stringify(value);
    }
    return actualReadFileSync(filePath, options as BufferEncoding);
  }) as typeof fs.readFileSync);
};

describe('revenue config validation', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    jest.resetModules();
  });

  it('throws when lane catalog shape is invalid', () => {
    mockConfigFile('config/lanes.json', { lanes: {} });
    const { loadLaneCatalog } = loadConfigModule();
    expect(() => loadLaneCatalog()).toThrow('Invalid lane catalog: currency and lanes are required');
  });

  it('throws when lane entry is invalid', () => {
    mockConfigFile('config/lanes.json', {
      currency: 'USD',
      lanes: [
        {
          slug: '',
          name: 'Broken lane',
          price: 10,
          sla_hours: 6,
          capabilities: ['cap'],
          deliverables: ['output'],
          max_input_chars: 100,
          human_review_required: true,
          enabled: true,
        },
      ],
    });
    const { loadLaneCatalog } = loadConfigModule();
    expect(() => loadLaneCatalog()).toThrow('Invalid lane config: missing-slug');
  });

  it('throws when service catalog shape is invalid', () => {
    mockConfigFile('config/services.json', { services: {} });
    const { loadServiceCatalog } = loadConfigModule();
    expect(() => loadServiceCatalog()).toThrow('Invalid service catalog: services are required');
  });

  it('throws when service entry is invalid', () => {
    mockConfigFile('config/services.json', {
      services: [
        {
          slug: '',
          name: 'Broken service',
          description: 'desc',
          recommended_lane: 'small-request',
          keywords: ['x'],
          deliverable_template: 'services/repo-triage.md',
          outputs: ['out'],
          enabled: true,
        },
      ],
    });
    const { loadServiceCatalog } = loadConfigModule();
    expect(() => loadServiceCatalog()).toThrow('Invalid service config: missing-slug');
  });

  it('throws when OpenClaw config is missing required sections', () => {
    mockConfigFile('config/openclaw.json', {
      engine: { default_lane: 'small-request' },
      routing: { issue_labels: ['a'] },
      guardrails: {},
    });
    const { loadOpenClawConfig } = loadConfigModule();
    expect(() => loadOpenClawConfig()).toThrow('Invalid OpenClaw config: engine, routing, and guardrails are required');
  });

  it('rejects template paths that escape repo root', () => {
    const { loadTemplate } = loadConfigModule();
    expect(() => loadTemplate('../outside.md')).toThrow('Template path cannot escape repository root');
  });
});
