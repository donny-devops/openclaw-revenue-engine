const importConfigWithReadMock = (readFileSyncImpl: (filePath: string) => string) => {
  jest.resetModules();
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const fs = require('fs') as typeof import('fs');
  jest.spyOn(fs, 'readFileSync').mockImplementation((filePath: fs.PathOrFileDescriptor) => {
    return readFileSyncImpl(String(filePath));
  });
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require('../../src/revenue/config') as typeof import('../../src/revenue/config');
};

describe('revenue config validation', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    jest.resetModules();
  });

  it('throws when lane catalog is missing required top-level fields', () => {
    const { loadLaneCatalog } = importConfigWithReadMock((filePath) => {
      if (filePath.includes('config/lanes.json')) return JSON.stringify({ currency: 'USD' });
      throw new Error(`Unexpected file read: ${filePath}`);
    });

    expect(() => loadLaneCatalog()).toThrow('Invalid lane catalog: currency and lanes are required');
  });

  it('throws when a lane entry is malformed', () => {
    const { loadLaneCatalog } = importConfigWithReadMock((filePath) => {
      if (filePath.includes('config/lanes.json')) {
        return JSON.stringify({
          currency: 'USD',
          lanes: [{
            slug: '',
            name: 'Broken lane',
            price: 10,
            sla_hours: 24,
            capabilities: [],
            deliverables: [],
            max_input_chars: 100,
            human_review_required: true,
            enabled: true,
          }],
        });
      }
      throw new Error(`Unexpected file read: ${filePath}`);
    });

    expect(() => loadLaneCatalog()).toThrow('Invalid lane config: missing-slug');
  });

  it('throws when service catalog has invalid shape', () => {
    const { loadServiceCatalog } = importConfigWithReadMock((filePath) => {
      if (filePath.includes('config/services.json')) return JSON.stringify({ services: {} });
      throw new Error(`Unexpected file read: ${filePath}`);
    });

    expect(() => loadServiceCatalog()).toThrow('Invalid service catalog: services are required');
  });

  it('throws when a service entry is malformed', () => {
    const { loadServiceCatalog } = importConfigWithReadMock((filePath) => {
      if (filePath.includes('config/services.json')) {
        return JSON.stringify({
          services: [{
            slug: '',
            name: 'Broken service',
            description: 'desc',
            recommended_lane: 'small-request',
            keywords: [],
            deliverable_template: 'services/x.md',
            outputs: [],
            enabled: true,
          }],
        });
      }
      throw new Error(`Unexpected file read: ${filePath}`);
    });

    expect(() => loadServiceCatalog()).toThrow('Invalid service config: missing-slug');
  });

  it('throws when openclaw config is missing required routing/guardrail fields', () => {
    const { loadOpenClawConfig } = importConfigWithReadMock((filePath) => {
      if (filePath.includes('config/openclaw.json')) {
        return JSON.stringify({
          engine: { default_lane: 'detailed-request', default_service: 'repo-triage' },
          routing: { issue_labels: ['moltgate'] },
          guardrails: {},
        });
      }
      throw new Error(`Unexpected file read: ${filePath}`);
    });

    expect(() => loadOpenClawConfig()).toThrow('Invalid OpenClaw config: engine, routing, and guardrails are required');
  });

  it('rejects template paths that try to escape repository root', () => {
    jest.resetModules();
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { loadTemplate } = require('../../src/revenue/config') as typeof import('../../src/revenue/config');

    expect(() => loadTemplate('../secrets.txt')).toThrow('Template path cannot escape repository root');
  });
});
