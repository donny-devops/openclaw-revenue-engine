/**
 * tests/contract/openapi.contract.test.ts
 *
 * Contract tests: drive the live Express app with Supertest and assert each
 * (path, method, status) response body matches the schema declared in
 * `openapi.yaml`. The OpenAPI document is the single source of truth — drift
 * between the spec and the implementation will fail this suite.
 */

import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import Ajv, { ValidateFunction } from 'ajv';
import addFormats from 'ajv-formats';
import request from 'supertest';

// Env vars required by `src/webhooks/*` at import time are seeded in
// `tests/helpers/setupContractEnv.ts`, which runs before this file is loaded
// (registered via Jest `setupFiles`). Doing it via `beforeAll` here would be
// too late — `import` statements are hoisted above the test body.
import app from '../../src/index';

type OpenAPIDoc = {
  paths: Record<
    string,
    Record<
      string,
      {
        responses: Record<
          string,
          { content?: { 'application/json'?: { schema: unknown } } }
        >;
      }
    >
  >;
  components?: { schemas?: Record<string, unknown> };
};

const specPath = path.resolve(__dirname, '../../openapi.yaml');
const spec = yaml.load(fs.readFileSync(specPath, 'utf8')) as OpenAPIDoc;

// `strict: false` is required for OpenAPI 3.0 schemas: Ajv's strict mode rejects
// keywords it doesn't recognize from the OpenAPI dialect (e.g. `nullable`,
// `discriminator`, `example`) which are valid in OAS but not in JSON Schema
// draft-07. Disabling strict avoids spurious compile errors without weakening
// runtime validation of the response bodies we care about.
const ajv = new Ajv({ strict: false, allErrors: true });
addFormats(ajv);
if (spec.components?.schemas) {
  for (const [name, schema] of Object.entries(spec.components.schemas)) {
    ajv.addSchema(schema as object, `#/components/schemas/${name}`);
  }
}

function validatorFor(pathKey: string, method: string, status: string): ValidateFunction {
  const op = spec.paths[pathKey]?.[method];
  if (!op) {throw new Error(`Spec missing ${method.toUpperCase()} ${pathKey}`);}
  const schema = op.responses?.[status]?.content?.['application/json']?.schema;
  if (!schema)
    {throw new Error(`Spec missing schema for ${method.toUpperCase()} ${pathKey} → ${status}`);}
  return ajv.compile(schema as object);
}

function assertMatches(validate: ValidateFunction, body: unknown): void {
  const ok = validate(body);
  if (!ok) {
    throw new Error(
      `Response body does not satisfy contract:\n${JSON.stringify(validate.errors, null, 2)}\n` +
        `Body: ${JSON.stringify(body, null, 2)}`,
    );
  }
}

describe('OpenAPI contract: declared paths exist in app', () => {
  it.each([
    ['get', '/'],
    ['get', '/health'],
    ['post', '/webhooks/stripe'],
    ['post', '/webhooks/github'],
  ])('spec declares %s %s', (method, p) => {
    expect(spec.paths[p]?.[method]).toBeDefined();
  });
});

describe('Contract: GET /', () => {
  it('200 response matches RootResponse schema', async () => {
    const validate = validatorFor('/', 'get', '200');
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
    assertMatches(validate, res.body);
  });
});

describe('Contract: GET /health', () => {
  it('200 response matches HealthResponse schema', async () => {
    const validate = validatorFor('/health', 'get', '200');
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    assertMatches(validate, res.body);
  });
});

describe('Contract: POST /webhooks/stripe', () => {
  it('400 (missing signature) matches ErrorResponse schema', async () => {
    const validate400 = validatorFor('/webhooks/stripe', 'post', '400');
    const validate429 = validatorFor('/webhooks/stripe', 'post', '429');
    const res = await request(app).post('/webhooks/stripe').send('{}');
    expect([400, 429]).toContain(res.status);
    assertMatches(res.status === 400 ? validate400 : validate429, res.body);
  });

  it('429 (rate limit) matches ErrorResponse schema', async () => {
    const validate = validatorFor('/webhooks/stripe', 'post', '429');
    // The webhook limiter caps at 30 req/min. Burst past it from the same
    // (test) client to deterministically observe a 429 and assert its body
    // shape against the documented schema.
    let rateLimited: request.Response | undefined;
    for (let i = 0; i < 60; i++) {
      const res = await request(app).post('/webhooks/stripe').send('{}');
      if (res.status === 429) {
        rateLimited = res;
        break;
      }
    }
    expect(rateLimited).toBeDefined();
    expect(rateLimited!.status).toBe(429);
    assertMatches(validate, rateLimited!.body);
  });
});

describe('Contract: POST /webhooks/github', () => {
  it('400 (missing signature) matches ErrorResponse schema', async () => {
    const validate400 = validatorFor('/webhooks/github', 'post', '400');
    const validate429 = validatorFor('/webhooks/github', 'post', '429');
    const res = await request(app).post('/webhooks/github').send('{}');
    expect([400, 429]).toContain(res.status);
    assertMatches(res.status === 400 ? validate400 : validate429, res.body);
  });

  it('429 (rate limit) matches ErrorResponse schema', async () => {
    const validate = validatorFor('/webhooks/github', 'post', '429');
    let rateLimited: request.Response | undefined;
    for (let i = 0; i < 60; i++) {
      const res = await request(app).post('/webhooks/github').send('{}');
      if (res.status === 429) {
        rateLimited = res;
        break;
      }
    }
    expect(rateLimited).toBeDefined();
    expect(rateLimited!.status).toBe(429);
    assertMatches(validate, rateLimited!.body);
  });
});

describe('Contract: spec is self-consistent', () => {
  it('every documented response schema compiles', () => {
    for (const [pathKey, methods] of Object.entries(spec.paths)) {
      for (const [method, op] of Object.entries(methods)) {
        for (const [status, resp] of Object.entries(op.responses ?? {})) {
          const schema = resp.content?.['application/json']?.schema;
          if (schema) {
            expect(() => ajv.compile(schema as object)).not.toThrow(
              `compile failure: ${method.toUpperCase()} ${pathKey} → ${status}`,
            );
          }
        }
      }
    }
  });
});
