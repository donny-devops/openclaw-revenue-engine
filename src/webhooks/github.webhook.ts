import { Request, Response } from 'express';
import crypto from 'crypto';

// ─── Bug 5 fix: fail fast at module load if required env vars are missing ───
// Previously used `as string` cast which silently allowed undefined,
// causing all HMAC checks to fail with no useful error message.
function requireEnv(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing required environment variable: ${key}`);
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
 * in index.ts BEFORE the global express.json() middleware. The raw Buffer is
 * required for HMAC verification. If json() runs first, req.body is a parsed
 * object; calling .toString('utf8') on it yields "[object Object]" and
 * JSON.parse throws a SyntaxError on every request (Bug 4).
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
  const signature = req.headers['x-hub-signature-256'] as string;
  const event = req.headers['x-github-event'] as string;
  const deliveryId = req.headers['x-github-delivery'] as string;

  if (!signature) {
    res.status(400).json({ error: 'Missing X-Hub-Signature-256 header' });
    return;
  }

  if (!event) {
    res.status(400).json({ error: 'Missing X-GitHub-Event header' });
    return;
  }

  // Verify HMAC-SHA256 signature using the raw Buffer
  const isValid = verifyGitHubSignature(
    req.body as Buffer,
    signature,
    githubWebhookSecret
  );

  if (!isValid) {
    console.error(`GitHub webhook signature mismatch for delivery ${deliveryId}`);
    res.status(401).json({ error: 'Invalid webhook signature' });
    return;
  }

  // Bug 4 fix: safely parse the raw Buffer body.
  // req.body is a Buffer here (express.raw applied in index.ts).
  // Guard against already-parsed objects to be safe.
  const payload = req.body instanceof Buffer
    ? (JSON.parse(req.body.toString('utf8')) as Record<string, unknown>)
    : (req.body as Record<string, unknown>);

  console.log(`GitHub webhook received: ${event} [delivery: ${deliveryId}]`);

  try {
    switch (event) {
      case 'push':
        await handlePushEvent(payload);
        break;
      case 'pull_request':
        await handlePullRequestEvent(payload);
        break;
      case 'release':
        await handleReleaseEvent(payload);
        break;
      case 'workflow_run':
        await handleWorkflowRunEvent(payload);
        break;
      case 'repository_dispatch':
        await handleRepositoryDispatch(payload);
        break;
      case 'ping':
        console.log('GitHub webhook ping received - connection verified');
        break;
      default:
        console.log(`Unhandled GitHub event: ${event}`);
    }

    res.status(200).json({
      received: true,
      event,
      delivery: deliveryId,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error(`Error processing GitHub webhook ${event}: ${message}`);
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

  // Use timingSafeEqual to prevent timing attacks
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

async function handlePushEvent(payload: Record<string, unknown>): Promise<void> {
  const ref = payload['ref'] as string;
  const repo = (payload['repository'] as Record<string, unknown>)['full_name'] as string;
  const pusher = (payload['pusher'] as Record<string, unknown>)['name'] as string;
  console.log(`Push to ${repo} on ${ref} by ${pusher}`);
  // TODO: Trigger deployment pipeline, invalidate caches, notify team
}

async function handlePullRequestEvent(
  payload: Record<string, unknown>
): Promise<void> {
  const action = payload['action'] as string;
  const pr = payload['pull_request'] as Record<string, unknown>;
  const number = pr['number'] as number;
  const title = pr['title'] as string;
  const repo = (payload['repository'] as Record<string, unknown>)['full_name'] as string;
  console.log(`PR #${number} ${action} in ${repo}: ${title}`);
  // TODO: Update review status, trigger preview deploys, notify Slack
}

async function handleReleaseEvent(
  payload: Record<string, unknown>
): Promise<void> {
  const action = payload['action'] as string;
  const release = payload['release'] as Record<string, unknown>;
  const tag = release['tag_name'] as string;
  const repo = (payload['repository'] as Record<string, unknown>)['full_name'] as string;
  console.log(`Release ${action}: ${tag} in ${repo}`);
  // TODO: Trigger production deploy, update changelog, notify stakeholders
}

async function handleWorkflowRunEvent(
  payload: Record<string, unknown>
): Promise<void> {
  const run = payload['workflow_run'] as Record<string, unknown>;
  const name = run['name'] as string;
  const status = run['status'] as string;
  const conclusion = run['conclusion'] as string;
  const repo = (payload['repository'] as Record<string, unknown>)['full_name'] as string;
  console.log(`Workflow "${name}" in ${repo}: ${status} / ${conclusion}`);
  // TODO: Alert on failures, update status dashboards
}

async function handleRepositoryDispatch(
  payload: Record<string, unknown>
): Promise<void> {
  const eventType = payload['action'] as string;
  const clientPayload = payload['client_payload'] as Record<string, unknown>;
  console.log(`repository_dispatch event: ${eventType}`);
  console.log('Client payload:', JSON.stringify(clientPayload, null, 2));
  // TODO: Handle custom dispatch events (e.g., deploy-staging, run-smoke-tests)
}
