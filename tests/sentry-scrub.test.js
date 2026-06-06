// Tests for issue #24 — sentry.js PII-scrubbing hooks have no unit tests.
// Exercises scrubString, scrubObject, beforeSend, and beforeBreadcrumb in isolation.

import { describe, it, expect, vi } from 'vitest';

// vi.mock is hoisted before imports, so @sentry/aws-serverless is stubbed out
// before sentry.js loads, preventing real SDK initialization.
vi.mock('@sentry/aws-serverless', () => ({
  default: {
    init: vi.fn(),
    wrapHandler: vi.fn((fn) => fn),
  },
}));

import {
  scrubString,
  scrubObject,
  beforeSend,
  beforeBreadcrumb,
} from '../lambda/lib/sentry.js';

// ── scrubString ────────────────────────────────────────────────────────────

describe('scrubString', () => {
  it('redacts an email address', () => {
    expect(scrubString('contact user@example.com for help')).toBe(
      'contact [REDACTED_EMAIL] for help',
    );
  });

  it('redacts multiple emails in one string', () => {
    const result = scrubString('from a@b.com to c@d.org');
    expect(result).not.toContain('a@b.com');
    expect(result).not.toContain('c@d.org');
    expect(result).toBe('from [REDACTED_EMAIL] to [REDACTED_EMAIL]');
  });

  it('redacts a JWT-shaped token', () => {
    const jwt = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c2VyIn0.SflKxwRJSMeKKF2QT4fw';
    expect(scrubString(`token=${jwt}`)).toBe('token=[REDACTED_JWT]');
  });

  it('returns a clean string unchanged', () => {
    expect(scrubString('no sensitive data here')).toBe('no sensitive data here');
  });

  it('passes through non-string values unchanged', () => {
    expect(scrubString(42)).toBe(42);
    expect(scrubString(null)).toBe(null);
    expect(scrubString(undefined)).toBe(undefined);
  });

  it('is idempotent — calling twice does not corrupt output', () => {
    const input = 'user@example.com';
    const once = scrubString(input);
    const twice = scrubString(once);
    expect(once).toBe('[REDACTED_EMAIL]');
    expect(twice).toBe('[REDACTED_EMAIL]');
  });
});

// ── scrubObject ────────────────────────────────────────────────────────────

describe('scrubObject', () => {
  it('redacts an email in a top-level string field', () => {
    const obj = { note: 'sent to user@example.com' };
    scrubObject(obj);
    expect(obj.note).toBe('sent to [REDACTED_EMAIL]');
    expect(obj.note).not.toContain('user@example.com');
  });

  it('redacts an email nested one level deep', () => {
    const obj = { nested: { email: 'user@example.com', safe: 'ok' } };
    scrubObject(obj);
    expect(obj.nested.email).toBe('[REDACTED_EMAIL]');
    expect(obj.nested.safe).toBe('ok');
  });

  it('redacts an email nested four levels deep (within the depth limit)', () => {
    const obj = { a: { b: { c: { d: 'deep@example.com' } } } };
    scrubObject(obj);
    expect(obj.a.b.c.d).toBe('[REDACTED_EMAIL]');
  });

  it('stops at depth 5 and leaves deeper values unchanged', () => {
    const obj = { a: { b: { c: { d: { e: { f: 'too@deep.com' } } } } } };
    scrubObject(obj);
    // f is at depth 5 (> 4) — scrubObject returns early, value untouched
    expect(obj.a.b.c.d.e.f).toBe('too@deep.com');
  });

  it('handles circular references without throwing (depth-limit guard)', () => {
    const circular = {};
    circular.self = circular;
    expect(() => scrubObject(circular)).not.toThrow();
  });

  it('handles null values without throwing', () => {
    expect(() => scrubObject({ nested: null })).not.toThrow();
  });

  it('leaves non-string, non-object values unchanged', () => {
    const obj = { count: 3, flag: true };
    scrubObject(obj);
    expect(obj.count).toBe(3);
    expect(obj.flag).toBe(true);
  });
});

// ── beforeSend ─────────────────────────────────────────────────────────────

describe('beforeSend', () => {
  it('removes email, username, and ip_address from event.user', () => {
    const event = {
      user: { email: 'a@b.com', username: 'alice', ip_address: '1.2.3.4', id: 'u1' },
    };
    const result = beforeSend(event);
    expect(result.user.email).toBeUndefined();
    expect(result.user.username).toBeUndefined();
    expect(result.user.ip_address).toBeUndefined();
    expect(result.user.id).toBe('u1');
  });

  it('handles missing event.user without throwing', () => {
    const event = { message: 'no user field' };
    expect(() => beforeSend(event)).not.toThrow();
  });

  it('scrubs email from exception value strings', () => {
    const event = {
      exception: { values: [{ value: 'failed for user@example.com' }] },
    };
    const result = beforeSend(event);
    expect(result.exception.values[0].value).toBe('failed for [REDACTED_EMAIL]');
  });

  it('scrubs email from breadcrumb messages (SDK v9 {values:[]} shape)', () => {
    const event = {
      breadcrumbs: { values: [{ message: 'request from user@example.com' }] },
    };
    expect(() => beforeSend(event)).not.toThrow();
    const result = beforeSend(event);
    expect(result.breadcrumbs.values[0].message).not.toContain('user@example.com');
    expect(result.breadcrumbs.values[0].message).toContain('[REDACTED_EMAIL]');
  });

  it('scrubs email from breadcrumb data objects (SDK v9 {values:[]} shape)', () => {
    const event = {
      breadcrumbs: { values: [{ data: { recipient: 'user@example.com' } }] },
    };
    const result = beforeSend(event);
    expect(result.breadcrumbs.values[0].data.recipient).toBe('[REDACTED_EMAIL]');
  });

  it('does not throw when breadcrumbs has no values array', () => {
    const event = { breadcrumbs: {} };
    expect(() => beforeSend(event)).not.toThrow();
  });

  it('scrubs email from event.extra', () => {
    const event = { extra: { note: 'contact user@example.com' } };
    const result = beforeSend(event);
    expect(result.extra.note).toBe('contact [REDACTED_EMAIL]');
  });

  it('returns the (mutated) event', () => {
    const event = { message: 'ok' };
    expect(beforeSend(event)).toBe(event);
  });
});

// ── beforeBreadcrumb ───────────────────────────────────────────────────────

describe('beforeBreadcrumb', () => {
  it('scrubs email from breadcrumb message', () => {
    const bc = { message: 'user@example.com logged in' };
    const result = beforeBreadcrumb(bc);
    expect(result.message).not.toContain('user@example.com');
    expect(result.message).toContain('[REDACTED_EMAIL]');
  });

  it('scrubs email from breadcrumb data', () => {
    const bc = { data: { email: 'user@example.com', action: 'login' } };
    const result = beforeBreadcrumb(bc);
    expect(result.data.email).toBe('[REDACTED_EMAIL]');
    expect(result.data.action).toBe('login');
  });

  it('handles missing message and data without throwing', () => {
    expect(() => beforeBreadcrumb({ category: 'ui' })).not.toThrow();
  });

  it('returns the (mutated) breadcrumb', () => {
    const bc = { message: 'ok' };
    expect(beforeBreadcrumb(bc)).toBe(bc);
  });
});
