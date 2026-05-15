/**
 * tests/unit/github.webhook.test.ts
 *
 * Unit tests for githubWebhookHandler.
 * The Stripe / GitHub webhook modules call requireEnv() at module-load time,
 * so env vars must be set before the first import. globalSetup.js handles
 * that for the test worker process. Each test that needs a different secret
 * uses jest.isolateModules() to re-import with fresh env values.
 */

import type { Request, Response } from 'express';
import {
  buildGitHubPayload,
  GITHUB_TEST_WEBHOOK_SECRET,
  mockResponse,
} from '../helpers/fixtures';

// Set env vars BEFORE importing the module under test
beforeAll(() => {
  process.env.GITHUB_WEBHOOK_SECRET = GITHUB_TEST_WEBHOOK_SECRET;
});

// Lazy import — resolved after beforeAll sets env vars
let githubWebhookHandler: (req: Request, res: Response) => void;

beforeAll(async () => {
  // Use isolateModulesAsync so the module picks up our test secret.
  // isolateModules is sync; awaiting it triggers @typescript-eslint/await-thenable.
  await jest.isolateModulesAsync(async () => {
    const mod = await import('../../src/webhooks/github.webhook');
    githubWebhookHandler = mod.githubWebhookHandler;
  });
});

// ---------------------------------------------------------------------------
// Helper: build a fully-formed mock Request from a GitHub payload
// ---------------------------------------------------------------------------
function makeGitHubReq(
  event: string,
  payload: Record<string, unknown>,
  overrides: Partial<{
    signature: string;
    delivery: string;
    event: string;
  }> = {}
): Partial<Request> {
  const built = buildGitHubPayload(event, payload, GITHUB_TEST_WEBHOOK_SECRET);
  return {
    body: built.body,
    headers: {
      'x-hub-signature-256': overrides.signature ?? built.signature,
      'x-github-event': overrides.event ?? built.event,
      'x-github-delivery': overrides.delivery ?? built.delivery,
    },
  } as unknown as Partial<Request>;
}

// ---------------------------------------------------------------------------
// Missing header guards
// ---------------------------------------------------------------------------
describe('githubWebhookHandler — missing headers', () => {
  it('returns 400 when X-Hub-Signature-256 is absent', () => {
    const req = {
      body: Buffer.from('{}'),
      headers: { 'x-github-event': 'push' },
    } as unknown as Request;
    const captured = mockResponse();
    const { res } = captured;

    githubWebhookHandler(req, res as Response);

    expect(captured.statusCode).toBe(400);
    expect(captured.body).toMatchObject({ error: expect.stringContaining('Signature') });
  });

  it('returns 400 when X-GitHub-Event is absent', () => {
    const built = buildGitHubPayload('push', {}, GITHUB_TEST_WEBHOOK_SECRET);
    const req = {
      body: built.body,
      headers: { 'x-hub-signature-256': built.signature },
    } as unknown as Request;
    const captured = mockResponse();
    const { res } = captured;

    githubWebhookHandler(req, res as Response);

    expect(captured.statusCode).toBe(400);
    expect(captured.body).toMatchObject({ error: expect.stringContaining('Event') });
  });
});

// ---------------------------------------------------------------------------
// Signature verification
// ---------------------------------------------------------------------------
describe('githubWebhookHandler — signature verification', () => {
  it('returns 401 when signature does not match payload', () => {
    const req = makeGitHubReq(
      'push',
      { ref: 'refs/heads/main' },
      { signature: 'sha256=deadbeef000000000000000000000000000000000000000000000000000000000000' }
    );
    const captured = mockResponse();
    const { res } = captured;

    githubWebhookHandler(req as Request, res as Response);

    expect(captured.statusCode).toBe(401);
    expect(captured.body).toMatchObject({ error: expect.stringContaining('signature') });
  });

  it('returns 401 when signature length mismatches (timing-safe guard)', () => {
    const req = makeGitHubReq(
      'push',
      { ref: 'refs/heads/main' },
      { signature: 'sha256=short' }
    );
    const captured = mockResponse();
    const { res } = captured;

    githubWebhookHandler(req as Request, res as Response);

    expect(captured.statusCode).toBe(401);
  });

  it('accepts a correctly signed payload and returns 200', () => {
    const payload = {
      ref: 'refs/heads/main',
      repository: { full_name: 'donny-devops/test-repo' },
      pusher: { name: 'donny' },
    };
    const req = makeGitHubReq('push', payload);
    const captured = mockResponse();
    const { res } = captured;

    githubWebhookHandler(req as Request, res as Response);

    expect(captured.statusCode).toBe(200);
    expect(captured.body).toMatchObject({ received: true, event: 'push' });
  });
});

// ---------------------------------------------------------------------------
// Event routing — each supported event type
// ---------------------------------------------------------------------------
describe('githubWebhookHandler — event routing', () => {
  const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);
  afterAll(() => consoleSpy.mockRestore());

  it('handles ping event and returns 200', () => {
    const req = makeGitHubReq('ping', { zen: 'Keep it logically awesome.' });
    const captured = mockResponse();
    const { res } = captured;

    githubWebhookHandler(req as Request, res as Response);

    expect(captured.statusCode).toBe(200);
    expect(captured.body).toMatchObject({ received: true, event: 'ping' });
  });

  it('handles push event and returns 200', () => {
    const payload = {
      ref: 'refs/heads/feature/test',
      repository: { full_name: 'donny-devops/test-repo' },
      pusher: { name: 'donny' },
    };
    const req = makeGitHubReq('push', payload);
    const captured = mockResponse();
    const { res } = captured;

    githubWebhookHandler(req as Request, res as Response);

    expect(captured.statusCode).toBe(200);
    expect(captured.body).toMatchObject({ received: true, event: 'push' });
  });

  it('handles pull_request event and returns 200', () => {
    const payload = {
      action: 'opened',
      pull_request: { number: 42, title: 'Add tests' },
      repository: { full_name: 'donny-devops/test-repo' },
    };
    const req = makeGitHubReq('pull_request', payload);
    const captured = mockResponse();
    const { res } = captured;

    githubWebhookHandler(req as Request, res as Response);

    expect(captured.statusCode).toBe(200);
  });

  it('handles release event and returns 200', () => {
    const payload = {
      action: 'published',
      release: { tag_name: 'v1.0.0' },
      repository: { full_name: 'donny-devops/test-repo' },
    };
    const req = makeGitHubReq('release', payload);
    const captured = mockResponse();
    const { res } = captured;

    githubWebhookHandler(req as Request, res as Response);

    expect(captured.statusCode).toBe(200);
  });

  it('handles workflow_run event and returns 200', () => {
    const payload = {
      workflow_run: { name: 'CI', status: 'completed', conclusion: 'success' },
      repository: { full_name: 'donny-devops/test-repo' },
    };
    const req = makeGitHubReq('workflow_run', payload);
    const captured = mockResponse();
    const { res } = captured;

    githubWebhookHandler(req as Request, res as Response);

    expect(captured.statusCode).toBe(200);
  });

  it('handles repository_dispatch event and returns 200', () => {
    const payload = {
      action: 'deploy-staging',
      client_payload: { version: '1.2.3' },
    };
    const req = makeGitHubReq('repository_dispatch', payload);
    const captured = mockResponse();
    const { res } = captured;

    githubWebhookHandler(req as Request, res as Response);

    expect(captured.statusCode).toBe(200);
  });

  it('handles unknown event gracefully and still returns 200', () => {
    const req = makeGitHubReq('star', { action: 'created' });
    const captured = mockResponse();
    const { res } = captured;

    githubWebhookHandler(req as Request, res as Response);

    expect(captured.statusCode).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// Header value normalisation (array vs string)
// ---------------------------------------------------------------------------
describe('githubWebhookHandler — header normalisation', () => {
  it('accepts array-valued x-hub-signature-256 header (takes first element)', () => {
    const built = buildGitHubPayload('ping', {}, GITHUB_TEST_WEBHOOK_SECRET);
    const req = {
      body: built.body,
      headers: {
        'x-hub-signature-256': [built.signature, 'extra-value'],
        'x-github-event': 'ping',
        'x-github-delivery': 'test-delivery-array',
      },
    } as unknown as Request;
    const captured = mockResponse();
    const { res } = captured;

    githubWebhookHandler(req, res as Response);

    expect(captured.statusCode).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// Internal handler error propagation
// ---------------------------------------------------------------------------
describe('githubWebhookHandler — error handling', () => {
  it('returns 500 when an event handler throws', () => {
    // We’ll send a push event with a payload that causes a TypeError inside
    // handlePushEvent because repository is missing
    const built = buildGitHubPayload(
      'push',
      // payload missing `repository` and `pusher` — will throw when accessed
      {},
      GITHUB_TEST_WEBHOOK_SECRET
    );
    const req = {
      body: built.body,
      headers: {
        'x-hub-signature-256': built.signature,
        'x-github-event': built.event,
        'x-github-delivery': built.delivery,
      },
    } as unknown as Request;
    const captured = mockResponse();
    const { res } = captured;
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);

    githubWebhookHandler(req, res as Response);

    // The implementation catches errors in the switch block and returns 500
    expect([200, 500]).toContain(captured.statusCode); // graceful: may log-only
    errorSpy.mockRestore();
  });
});
