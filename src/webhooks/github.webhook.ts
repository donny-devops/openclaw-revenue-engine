import { Request, Response } from 'express';
import crypto from 'crypto';

function requireEnv(key: string): string {
  const val = process.env[key];
  if (!val) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return val;
}

/**
 * GitHub Webhook Handler
 *
 * Verifies the GitHub HMAC-SHA256 signature from the X-Hub-Signature-256
 * header, then routes each event to its appropriate handler.
 *
 * IMPORTANT: Register this handler with express.raw({ type: 'application/json' })
 * before global express.json() middleware.
 */
export function githubWebhookHandler(
  req: Request,
  res: Response
): void {
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

  let githubWebhookSecret: string;
  try {
    githubWebhookSecret = requireEnv('GITHUB_WEBHOOK_SECRET');
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error(`GitHub webhook configuration failure: ${message}`);
    res.status(500).json({ error: 'GitHub webhook is not configured' });
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

  let payload: Record<string, unknown>;
  try {
    payload = req.body instanceof Buffer
      ? (JSON.parse(req.body.toString('utf8')) as Record<string, unknown>)
      : (req.body as Record<string, unknown>);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error(`Invalid GitHub webhook JSON for delivery ${delivery ?? 'unknown'}: ${message}`);
    res.status(400).json({ error: 'Invalid webhook JSON payload' });
    return;
  }

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

function requireRecord(value: unknown, field: string): Record<string, unknown> {
  if (!value || typeof value !== 'object') {
    throw new Error(`Missing or invalid GitHub webhook field: ${field}`);
  }
  return value as Record<string, unknown>;
}

function handlePushEvent(payload: Record<string, unknown>): void {
  const ref = String(payload['ref']);
  const repository = requireRecord(payload['repository'], 'repository');
  const pusher = requireRecord(payload['pusher'], 'pusher');
  const repo = String(repository['full_name']);
  const pusherName = String(pusher['name']);
  console.log(`Push to ${repo} on ${ref} by ${pusherName}`);
}

function handlePullRequestEvent(payload: Record<string, unknown>): void {
  const action = String(payload['action']);
  const pr = requireRecord(payload['pull_request'], 'pull_request');
  const repository = requireRecord(payload['repository'], 'repository');
  const number = pr['number'] as number;
  const title = String(pr['title']);
  const repo = String(repository['full_name']);
  console.log(`PR #${number} ${action} in ${repo}: ${title}`);
}

function handleReleaseEvent(payload: Record<string, unknown>): void {
  const action = String(payload['action']);
  const release = requireRecord(payload['release'], 'release');
  const repository = requireRecord(payload['repository'], 'repository');
  const tag = String(release['tag_name']);
  const repo = String(repository['full_name']);
  console.log(`Release ${action}: ${tag} in ${repo}`);
}

function handleWorkflowRunEvent(payload: Record<string, unknown>): void {
  const run = requireRecord(payload['workflow_run'], 'workflow_run');
  const repository = requireRecord(payload['repository'], 'repository');
  const name = String(run['name']);
  const status = String(run['status']);
  const conclusion = String(run['conclusion']);
  const repo = String(repository['full_name']);
  console.log(`Workflow "${name}" in ${repo}: ${status} / ${conclusion}`);
}

function handleRepositoryDispatch(payload: Record<string, unknown>): void {
  const eventType = String(payload['action']);
  const clientPayload = requireRecord(payload['client_payload'], 'client_payload');
  console.log(`repository_dispatch event: ${eventType}`);
  console.log('Client payload:', JSON.stringify(clientPayload, null, 2));
}
