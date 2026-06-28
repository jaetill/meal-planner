// Regression test for issue #102 — user email was written verbatim into the
// GitHub issue body, exposing PII to anyone with repo read access.
//
// Verifies:
//   1. Email does NOT appear in the GitHub issue body.
//   2. Email IS written to S3 under feedback-contacts/{issueNumber}.json.
//   3. No S3 call is made when no email is supplied.
//   4. An S3 write failure does not cause the HTTP response to fail.

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@sentry/aws-serverless', () => ({
  default: {
    init: vi.fn(),
    wrapHandler: vi.fn((fn) => fn),
    captureException: vi.fn(),
  },
}));

vi.mock('@aws-sdk/client-secrets-manager', () => ({
  SecretsManagerClient: vi.fn(),
  GetSecretValueCommand: vi.fn(),
}));

vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: vi.fn(),
  PutObjectCommand: vi.fn((input) => ({ input })),
}));

vi.mock('../lambda/lib/logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const { _createHandler } = await import('../lambda/feedback.js');

function makeSmClient() {
  return {
    send: vi.fn().mockResolvedValue({
      SecretString: JSON.stringify({ GITHUB_TOKEN: 'ghp_test' }),
    }),
  };
}

function makeEvent(overrides = {}) {
  return {
    httpMethod: 'POST',
    headers: { origin: 'https://meals.jaetill.com' },
    requestContext: {
      identity: { sourceIp: '1.2.3.4' },
    },
    body: JSON.stringify({
      type: 'bug',
      description: 'Something is broken on the recipes page',
      ...overrides,
    }),
  };
}

describe('feedback email PII — issue #102', () => {
  let s3Send;
  let octokitInstance;
  let issueCreate;

  beforeEach(() => {
    s3Send = vi.fn().mockResolvedValue({});

    const IssueNumber = 42;
    issueCreate = vi.fn().mockResolvedValue({ data: { number: IssueNumber } });
    octokitInstance = class {
      get rest() {
        return { issues: { create: issueCreate } };
      }
    };
  });

  it('email address is not written into the GitHub issue body', async () => {
    const handler = _createHandler({
      smClient: makeSmClient(),
      Octokit: octokitInstance,
      s3Client: { send: s3Send },
      checkRateLimit: () => ({ allowed: true }),
    });

    const res = await handler(makeEvent({ email: 'alice@example.com' }), {});
    expect(res.statusCode).toBe(201);

    const body = issueCreate.mock.calls[0][0].body;
    expect(body).not.toContain('alice@example.com');
    expect(body).not.toContain('Email:');
  });

  it('email is written to S3 under feedback-contacts/{issueNumber}.json', async () => {
    const handler = _createHandler({
      smClient: makeSmClient(),
      Octokit: octokitInstance,
      s3Client: { send: s3Send },
      checkRateLimit: () => ({ allowed: true }),
    });

    await handler(makeEvent({ email: 'alice@example.com' }), {});

    expect(s3Send).toHaveBeenCalledOnce();
    const cmd = s3Send.mock.calls[0][0];
    expect(cmd.input.Key).toBe('feedback-contacts/42.json');
    const stored = JSON.parse(cmd.input.Body);
    expect(stored.email).toBe('alice@example.com');
    expect(stored.issue_number).toBe(42);
  });

  it('no S3 call is made when no email is supplied', async () => {
    const handler = _createHandler({
      smClient: makeSmClient(),
      Octokit: octokitInstance,
      s3Client: { send: s3Send },
      checkRateLimit: () => ({ allowed: true }),
    });

    const res = await handler(makeEvent(), {});
    expect(res.statusCode).toBe(201);
    expect(s3Send).not.toHaveBeenCalled();
  });

  it('S3 write failure does not cause a non-201 response', async () => {
    s3Send = vi.fn().mockRejectedValue(new Error('S3 access denied'));

    const handler = _createHandler({
      smClient: makeSmClient(),
      Octokit: octokitInstance,
      s3Client: { send: s3Send },
      checkRateLimit: () => ({ allowed: true }),
    });

    const res = await handler(makeEvent({ email: 'alice@example.com' }), {});
    expect(res.statusCode).toBe(201);
  });
});
