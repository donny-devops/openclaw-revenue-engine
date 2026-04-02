import { Request, Response } from 'express';
import crypto from 'crypto';

// ─── Fail fast at module load if required env vars are missing ───
function requireEnv(key: string): string {
  const val = process.env[key];
  if (!val) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return val;
}

const githubWebhookSecret = requireEnv('GITHUB_WEBHOOK_SECRET');

/**
 * GitHub Webhook Handler
 *
 * Verifies the GitHub HMAC-SHA256 signature from the X-Hub-Signature-256
 * header, then routes each event to its appropriate handler.
 *
 * IMPORTANT: This handler must be registered with express.raw({ type: 'application/json' })
 * in index.ts BEFORE the global express.json() middleware.
 *
 * Supported events:
 *   - push              (code pushed to any branch)
 *   - pull_request      (PR opened, closed, merged, synchronized)
 *   - release           (release published)
 *   - workflow_run      (GitHub Actions workflow completed)
 *   - repository_dispatch (custom event triggered externally)
 */
export async function githubWebhookHandler(
  req: Request,
  res: Response
): Promise<void> {
  const rawSignature = req.headers['x-hub-signature-256'];
  const event = req.headers['x-github-event'];
  const deliveryId = req.headers['x-github-delivery'];

  const signature = Array.isArray(rawSignature) ? rawSignature[0] : rawSignature;
  const eventName = Array.isArray(event) ? event[0] : event;
  const delivery = Array.isArray(deliveryId) ? deliveryId[0] : deliveryId;

  if (!signature) {
    res.status(400).json({ error: 'Missing X-Hub-Signature-256 header' });
    return;
  }

  if (!eventName) {
    res.status(400).json({ error: 'Missing X-GitHub-Event header' });
    return;
  }

  const isValid = verifyGitHubSignature(
    req.body as Buffer,
    signature,
    githubWebhookSecret
  );

  if (!isValid) {
    console.error(`GitHub webhook signature mismatch for delivery ${delivery ?? 'unknown'}`);
    res.status(401).json({ error: 'Invalid webhook signature' });
    return;
  }

  const payload: Record<string, unknown> =
    req.body instanceof Buffer
      ? (JSON.parse(req.body.toString('utf8')) as Record<string, unknown>)
      : (req.body as Record<string, unknown>);

  console.log(`GitHub webhook received: ${eventName} [delivery: ${delivery ?? 'unknown'}]`);

  try {
    switch (eventName) {
      case 'push':
        handlePushEvent(payload);
        break;
      case 'pull_request':
        handlePullRequestEvent(payload);
        break;
      case 'release':
        handleReleaseEvent(payload);
        break;
      case 'workflow_run':
        handleWorkflowRunEvent(payload);
        break;
      case 'repository_dispatch':
        handleRepositoryDispatch(payload);
        break;
      case 'ping':
        console.log('GitHub webhook ping received - connection verified');
        break;
      default:
        console.log(`Unhandled GitHub event: ${eventName}`);
    }
    res.status(200).json({
      received: true,
      event: eventName,
      delivery,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error(`Error processing GitHub webhook ${eventName}: ${message}`);
    res.status(500).json({ error: 'Internal webhook processing error' });
  }
}

// ---------------------------------------------------------------------------
// Signature Verification
// ---------------------------------------------------------------------------

function verifyGitHubSignature(
  body: Buffer,
  signature: string,
  secret: string
): boolean {
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(body);
  const digest = `sha256=${hmac.digest('hex')}`;
  try {
    return crypto.timingSafeEqual(
      Buffer.from(digest, 'utf8'),
      Buffer.from(signature, 'utf8')
    );
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Event Handlers
// ---------------------------------------------------------------------------

function handlePushEvent(payload: Record<string, unknown>): void {
  const ref = String(payload['ref']);
  const repo = String((payload['repository'] as Record<string, unknown>)['full_name']);
  const pusher = String((payload['pusher'] as Record<string, unknown>)['name']);
  console.log(`Push to ${repo} on ${ref} by ${pusher}`);
  // TODO: Trigger deployment pipeline, invalidate caches, notify team
}

function handlePullRequestEvent(payload: Record<string, unknown>): void {
  const action = String(payload['action']);
  const pr = payload['pull_request'] as Record<string, unknown>;
  const number = pr['number'] as number;
  const title = String(pr['title']);
  const repo = String((payload['repository'] as Record<string, unknown>)['full_name']);
  console.log(`PR #${number} ${action} in ${repo}: ${title}`);
  // TODO: Update review status, trigger preview deploys, notify Slack
}

function handleReleaseEvent(payload: Record<string, unknown>): void {
  const action = String(payload['action']);
  const release = payload['release'] as Record<string, unknown>;
  const tag = String(release['tag_name']);
  const repo = String((payload['repository'] as Record<string, unknown>)['full_name']);
  console.log(`Release ${action}: ${tag} in ${repo}`);
  // TODO: Trigger production deploy, update changelog, notify stakeholders
}

function handleWorkflowRunEvent(payload: Record<string, unknown>): void {
  const run = payload['workflow_run'] as Record<string, unknown>;
  const name = String(run['name']);
  const status = String(run['status']);
  const conclusion = String(run['conclusion']);
  const repo = String((payload['repository'] as Record<string, unknown>)['full_name']);
  console.log(`Workflow "${name}" in ${repo}: ${status} / ${conclusion}`);
  // TODO: Alert on failures, update status dashboards
}

function handleRepositoryDispatch(payload: Record<string, unknown>): void {
  const eventType = String(payload['action']);
  const clientPayload = payload['client_payload'] as Record<string, unknown>;
  console.log(`repository_dispatch event: ${eventType}`);
  console.log('Client payload:', JSON.stringify(clientPayload, null, 2));
  // TODO: Handle custom dispatch events (e.g., deploy-staging, run-smoke-tests)
}
