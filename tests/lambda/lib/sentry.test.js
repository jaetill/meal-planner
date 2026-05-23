import { describe, it, expect, vi } from 'vitest';

// Mock must be declared before the import that triggers Sentry.init.
// vi.mock is hoisted automatically by vitest.
vi.mock('@sentry/aws-serverless', () => ({
  default: { init: vi.fn(), wrapHandler: vi.fn((fn) => fn) },
  init: vi.fn(),
  wrapHandler: vi.fn((fn) => fn),
}));

// sentry.js is CJS; import it as a default CJS interop import.
const { _beforeSend, _beforeBreadcrumb } = await import('../../../lambda/lib/sentry.js');

describe('sentry beforeSend — SDK v9 breadcrumb shape', () => {
  it('scrubs email in breadcrumbs without throwing (SDK v9 {values:[]} shape)', () => {
    const event = {
      breadcrumbs: { values: [{ message: 'user@example.com' }] },
    };
    expect(() => _beforeSend(event)).not.toThrow();
    expect(event.breadcrumbs.values[0].message).toBe('[REDACTED_EMAIL]');
  });

  it('scrubs JWT token in breadcrumb message', () => {
    const jwt = 'eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJ1c2VyIn0.SflKxwRJSMeKKF2QT4fwpM';
    const event = { breadcrumbs: { values: [{ message: `token: ${jwt}` }] } };
    expect(() => _beforeSend(event)).not.toThrow();
    expect(event.breadcrumbs.values[0].message).not.toContain(jwt);
    expect(event.breadcrumbs.values[0].message).toContain('[REDACTED_JWT]');
  });

  it('does not throw when event.breadcrumbs is absent', () => {
    expect(() => _beforeSend({})).not.toThrow();
  });

  it('does not throw when breadcrumbs.values is an empty array', () => {
    expect(() => _beforeSend({ breadcrumbs: { values: [] } })).not.toThrow();
  });

  it('strips PII fields from event.user', () => {
    const event = {
      user: { email: 'a@b.com', username: 'u', ip_address: '1.2.3.4', id: 'abc' },
    };
    _beforeSend(event);
    expect(event.user.email).toBeUndefined();
    expect(event.user.username).toBeUndefined();
    expect(event.user.ip_address).toBeUndefined();
    expect(event.user.id).toBe('abc');
  });

  it('scrubs email in breadcrumb data objects', () => {
    const event = {
      breadcrumbs: { values: [{ data: { msg: 'hello@world.org' } }] },
    };
    _beforeSend(event);
    expect(event.breadcrumbs.values[0].data.msg).toBe('[REDACTED_EMAIL]');
  });
});

describe('sentry beforeBreadcrumb', () => {
  it('scrubs email from breadcrumb message', () => {
    const bc = { message: 'contact admin@example.com now' };
    _beforeBreadcrumb(bc);
    expect(bc.message).toBe('contact [REDACTED_EMAIL] now');
  });
});
