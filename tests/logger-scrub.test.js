// Regression tests for issue #25 — scrubFields does not recurse into nested objects.
// Verifies that PII in nested log fields is redacted before CloudWatch emission.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import logger from '../lambda/lib/logger.js';

function captureLog(fn) {
  const records = [];
  const spy = vi.spyOn(console, 'log').mockImplementation((json) => {
    records.push(JSON.parse(json));
  });
  fn();
  spy.mockRestore();
  return records;
}

describe('logger scrubFields — top-level PII (regression)', () => {
  it('redacts top-level email field', () => {
    const [rec] = captureLog(() => logger.info('evt', { email: 'user@example.com' }));
    expect(rec.email).toBe('[REDACTED]');
  });

  it('redacts top-level token field', () => {
    const [rec] = captureLog(() => logger.info('evt', { token: 'abc123' }));
    expect(rec.token).toBe('[REDACTED]');
  });

  it('scrubs email pattern in top-level string value', () => {
    const [rec] = captureLog(() => logger.info('evt', { note: 'contact user@example.com' }));
    expect(rec.note).toContain('[REDACTED_EMAIL]');
    expect(rec.note).not.toContain('user@example.com');
  });
});

describe('logger scrubFields — nested PII (issue #25 fix)', () => {
  it('redacts email nested one level deep', () => {
    const [rec] = captureLog(() =>
      logger.info('share.sent', { recipient: { email: 'user@example.com' } }),
    );
    expect(rec.recipient.email).toBe('[REDACTED]');
  });

  it('redacts token nested one level deep', () => {
    const [rec] = captureLog(() =>
      logger.info('auth', { credentials: { token: 'secret-token', userId: 'u1' } }),
    );
    expect(rec.credentials.token).toBe('[REDACTED]');
    expect(rec.credentials.userId).toBe('u1');
  });

  it('redacts PII nested two levels deep', () => {
    const [rec] = captureLog(() =>
      logger.info('evt', { a: { b: { email: 'deep@example.com' } } }),
    );
    expect(rec.a.b.email).toBe('[REDACTED]');
  });

  it('scrubs email regex pattern in nested string value', () => {
    const [rec] = captureLog(() =>
      logger.info('evt', { meta: { note: 'sent to deep@example.com' } }),
    );
    expect(rec.meta.note).toContain('[REDACTED_EMAIL]');
    expect(rec.meta.note).not.toContain('deep@example.com');
  });

  it('leaves non-PII nested fields unchanged', () => {
    const [rec] = captureLog(() =>
      logger.info('evt', { stats: { count: 3, label: 'ok' } }),
    );
    expect(rec.stats.label).toBe('ok');
  });

  it('handles nested null without throwing', () => {
    expect(() =>
      captureLog(() => logger.info('evt', { nested: null })),
    ).not.toThrow();
  });

  it('redacts PII fields inside array elements', () => {
    const [rec] = captureLog(() =>
      logger.info('evt', { items: [{ email: 'arr@example.com' }] }),
    );
    expect(rec.items[0].email).toBe('[REDACTED]');
  });
});
