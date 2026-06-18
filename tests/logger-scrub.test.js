// Regression tests for issue #25 — scrubFields does not recurse into nested objects.
// Verifies that PII in nested log fields is redacted before CloudWatch emission.

import { describe, it, expect, vi } from 'vitest';
import logger, { scrubString, scrubFields, PII_FIELDS } from '../lambda/lib/logger.js';

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

// ── Direct unit tests for scrubString and scrubFields (issue #23) ──────────

describe('scrubString (unit)', () => {
  it('redacts an email with an unusual TLD', () => {
    expect(scrubString('user foo@bar.co.uk logged in')).toBe('user [REDACTED_EMAIL] logged in');
  });

  it('redacts a JWT-shaped string', () => {
    const jwt =
      'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c2VyIn0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
    expect(scrubString(jwt)).toBe('[REDACTED_JWT]');
  });

  it('returns a string with no PII unchanged', () => {
    expect(scrubString('no pii here')).toBe('no pii here');
  });

  it('redacts multiple emails in one string', () => {
    expect(scrubString('from a@b.com to c@d.co.uk')).toBe(
      'from [REDACTED_EMAIL] to [REDACTED_EMAIL]',
    );
  });
});

describe('scrubFields (unit)', () => {
  it('redacts a PII field by name and leaves non-PII unchanged', () => {
    const rec = { email: 'user@example.com', message: 'ok' };
    scrubFields(rec);
    expect(rec.email).toBe('[REDACTED]');
    expect(rec.message).toBe('ok');
  });

  it('scrubs email pattern in a non-PII string field', () => {
    const rec = { note: 'sent to user@example.com' };
    scrubFields(rec);
    expect(rec.note).toBe('sent to [REDACTED_EMAIL]');
  });

  it('PII_FIELDS contains expected platform-common and meal-planner entries', () => {
    for (const field of [
      'email',
      'token',
      'authorization',
      'password',
      'krogerAccessToken',
      'anthropicApiKey',
    ]) {
      expect(PII_FIELDS, `expected ${field} in PII_FIELDS`).toContain(field);
    }
  });
});

describe('LOG_LEVEL filtering', () => {
  it('suppresses DEBUG when LOG_LEVEL is INFO (default)', () => {
    // minLevel is resolved to INFO at module-load time when LOG_LEVEL env var is unset.
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    logger.debug('should be suppressed', {});
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('emits INFO messages to console.log', () => {
    const records = captureLog(() => logger.info('visible', {}));
    expect(records).toHaveLength(1);
    expect(records[0].message).toBe('visible');
  });
});
