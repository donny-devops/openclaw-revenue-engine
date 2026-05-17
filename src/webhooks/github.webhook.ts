import crypto from 'crypto';
import { Request, Response } from 'express';

import { getRequiredEnv, toErrorMessage } from '../config/env';
import {
  getHeaderValue,
  sendBadRequest,
  sendServiceMisconfigured,
  sendUnauthorized,
  sendWebhookProcessingError,
} from '../utils/http';

type GitHubPayload = Record<string, unknown>;

interface GitHubWebhookContext {
  signature: string;
  eventName: string;
  delivery?: string;
  payload: GitHubPayload;
}

export function githubWebhookHandler(req: Request, res: Response): void {
  let context: GitHubWebhookContext;

  try {
    context = buildGitHubWebhookContext(req);
  } catch (err) {
    sendBadRequest(res, toErrorMessage(err));
    return;
  }

  let githubWebhookSecret: string;
  try {
    githubWebhookSecret = getRequiredEnv('GITHUB_WEBHOOK_SECRET');
  } catch (err) {
    console.error(`GitHub webhook configuration failure: ${toErrorMessage(err)}`);
    sendServiceMisconfigured(res, 'GitHub');
    return;
  }

  if (!verifyGitHubSignature(req.body as Buffer, context.signature, githubWebhookSecret)) {
    console.error(`GitHub webhook signature mismatch for delivery ${context.delivery ?? 'unknown'}`);
    sendUnauthorized(res, 'Invalid webhook signature');
    return;
  }

  console.log(
    `GitHub webhook received: ${context.eventName} [delivery: ${context.delivery ?? 'unknown'}]`
  );

  try {
    dispatchGitHubEvent(context.eventName, context.payload);
    res.status(200).json({
      received: true,
      event: context.eventName,
      delivery: context.delivery,
    });
  } catch (err) {
    console.error(`Error processing GitHub webhook ${context.eventName}: ${toErrorMessage(err)}`);
    sendWebhookProcessingError(res);
  }
}

function buildGitHubWebhookContext(req: Request): GitHubWebhookContext {
  const signature = getHeaderValue(req.headers['x-hub-signature-256']);
  const eventName = getHeaderValue(req.headers['x-github-event']);
  const delivery = getHeaderValue(req.headers['x-github-delivery']);

  if (!signature) {
    throw new Error('Missing X-Hub-Signature-256 header');
  }

  if (!eventName) {
    throw new Error('Missing X-GitHub-Event header');
  }

  return {
    signature,
    eventName,
    delivery,
    payload: parseGitHubPayload(req.body),
  };
}

function parseGitHubPayload(body: unknown): GitHubPayload {
  if (body instanceof Buffer) {
    return JSON.parse(body.toString('utf8')) as GitHubPayload;
  }

  if (body && typeof body === 'object') {
    return body as GitHubPayload;
  }

  throw new Error('Invalid webhook JSON payload');
}

function dispatchGitHubEvent(eventName: string, payload: GitHubPayload): void {
  const handlers: Record<string, (payload: GitHubPayload) => void> = {
    push: handlePushEvent,
    pull_request: handlePullRequestEvent,
    release: handleReleaseEvent,
    workflow_run: handleWorkflowRunEvent,
    repository_dispatch: handleRepositoryDispatch,
    ping: () => console.log('GitHub webhook ping received - connection verified'),
  };

  const handler = handlers[eventName];
  if (!handler) {
    console.log(`Unhandled GitHub event: ${eventName}`);
    return;
  }

  handler(payload);
}

function verifyGitHubSignature(body: Buffer, signature: string, secret: string): boolean {
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(body);
  const digest = `sha256=${hmac.digest('hex')}`;

  try {
    return crypto.timingSafeEqual(Buffer.from(digest, 'utf8'), Buffer.from(signature, 'utf8'));
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

function readString(record: Record<string, unknown>, field: string): string {
  const value = record[field];
  if (typeof value !== 'string') {
    throw new Error(`Missing or invalid GitHub webhook field: ${field}`);
  }
  return value;
}

function handlePushEvent(payload: GitHubPayload): void {
  const repository = requireRecord(payload.repository, 'repository');
  const pusher = requireRecord(payload.pusher, 'pusher');
  console.log(
    `Push to ${readString(repository, 'full_name')} on ${String(payload.ref)} by ${readString(pusher, 'name')}`
  );
}

function handlePullRequestEvent(payload: GitHubPayload): void {
  const pr = requireRecord(payload.pull_request, 'pull_request');
  const repository = requireRecord(payload.repository, 'repository');
  console.log(
    `PR #${String(pr.number)} ${String(payload.action)} in ${readString(repository, 'full_name')}: ${String(pr.title)}`
  );
}

function handleReleaseEvent(payload: GitHubPayload): void {
  const release = requireRecord(payload.release, 'release');
  const repository = requireRecord(payload.repository, 'repository');
  console.log(
    `Release ${String(payload.action)}: ${readString(release, 'tag_name')} in ${readString(repository, 'full_name')}`
  );
}

function handleWorkflowRunEvent(payload: GitHubPayload): void {
  const run = requireRecord(payload.workflow_run, 'workflow_run');
  const repository = requireRecord(payload.repository, 'repository');
  console.log(
    `Workflow "${String(run.name)}" in ${readString(repository, 'full_name')}: ${String(run.status)} / ${String(run.conclusion)}`
  );
}

function handleRepositoryDispatch(payload: GitHubPayload): void {
  const clientPayload = requireRecord(payload.client_payload, 'client_payload');
  console.log(`repository_dispatch event: ${String(payload.action)}`);
  console.log('Client payload:', JSON.stringify(clientPayload, null, 2));
}
