import path from 'path';
import fs from 'fs';

const asPosix = (value: string): string => value.replace(/\\/g, '/');

const withMockedConfigFile = <T>(
  suffix: string,
  payload: unknown,
  run: () => T,
): T => {
  const originalRead = jest.requireActual('fs').readFileSync as typeof fs.readFileSync;
  const spy = jest.spyOn(fs, 'readFileSync').mockImplementation((filePath, options) => {
    const target = asPosix(String(filePath));
    if (target.endsWith(suffix)) {
      return JSON.stringify(payload);
    }
    return originalRead(filePath, options);
  });

  try {
    return run();
  } finally {
    spy.mockRestore();
  }
};

const loadConfigModule = (): typeof import('../../src/revenue/config') => {
  jest.resetModules();
  let configModule!: typeof import('../../src/revenue/config');
  jest.isolateModules(() => {
    configModule = jest.requireActual('../../src/revenue/config') as typeof import('../../src/revenue/config');
  });
  return configModule;
};

describe('revenue config validation', () => {
  it('throws when lane catalog is missing required top-level fields', () => {
    withMockedConfigFile('/config/lanes.json', { lanes: [] }, () => {
      const config = loadConfigModule();
      expect(() => config.loadLaneCatalog()).toThrow('Invalid lane catalog: currency and lanes are required');
    });
  });

  it('throws when a lane entry has invalid field types', () => {
    withMockedConfigFile('/config/lanes.json', {
      currency: 'USD',
      lanes: [{
        slug: 'bad-lane',
        name: 'Bad Lane',
        price: 10,
        sla_hours: 2,
        capabilities: ['x'],
        deliverables: ['y'],
        max_input_chars: 100,
        human_review_required: true,
        enabled: 'yes',
      }],
    }, () => {
      const config = loadConfigModule();
      expect(() => config.loadLaneCatalog()).toThrow('Invalid lane config: bad-lane');
    });
  });

  it('throws when service catalog does not provide a services array', () => {
    withMockedConfigFile('/config/services.json', { services: null }, () => {
      const config = loadConfigModule();
      expect(() => config.loadServiceCatalog()).toThrow('Invalid service catalog: services are required');
    });
  });

  it('throws when a service entry has invalid fields', () => {
    withMockedConfigFile('/config/services.json', {
      services: [{
        slug: 'bad-service',
        name: 'Bad Service',
        description: 'desc',
        recommended_lane: 'small-request',
        keywords: 'repo',
        deliverable_template: 'services/repo-triage.md',
        outputs: ['x'],
        enabled: true,
      }],
    }, () => {
      const config = loadConfigModule();
      expect(() => config.loadServiceCatalog()).toThrow('Invalid service config: bad-service');
    });
  });

  it('throws when OpenClaw config is missing required engine/routing/guardrails data', () => {
    withMockedConfigFile('/config/openclaw.json', {
      engine: { default_lane: 'detailed-request', default_service: 'repo-triage' },
      routing: { issue_labels: ['moltgate'], priority_labels: null },
      guardrails: { require_human_review: 'yes' },
    }, () => {
      const config = loadConfigModule();
      expect(() => config.loadOpenClawConfig()).toThrow('Invalid OpenClaw config: engine, routing, and guardrails are required');
    });
  });

  it('rejects template paths that escape repository root', () => {
    const config = loadConfigModule();
    expect(() => config.loadTemplate(`..${path.sep}package.json`)).toThrow('Template path cannot escape repository root');
  });
});
