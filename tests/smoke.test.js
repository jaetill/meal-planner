// Smoke test: vitest can run, the test runner is healthy.
// More meaningful tests will be added by the test-writer agent on
// subsequent PRs. This file exists so `npm test` exits 0 on a fresh
// clone before any real tests are written.

import { describe, it, expect } from 'vitest';

describe('vitest smoke', () => {
  it('the test runner is wired and basic assertions work', () => {
    expect(1 + 1).toBe(2);
  });
});