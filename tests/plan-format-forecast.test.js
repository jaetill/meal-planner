// Regression test for issue #30 — degree sign ° was mojibake-encoded to Â°
// in formatForecast(), corrupting the weather forecast injected into Claude prompts.
//
// plan-utils.js is a pure module (no AWS/Sentry deps) so no mocking needed.

import { describe, it, expect } from 'vitest';
import { formatForecast } from '../lambda/lib/plan-utils.js';

describe('formatForecast — degree sign encoding', () => {
  it('contains °F (not Â°F) for temperatures', () => {
    const result = formatForecast([{ date: '2026-05-17', highF: 85, lowF: 65, code: 0, precipMm: 0 }]);
    expect(result).toContain('°F');
    expect(result).not.toContain('Â°F');
  });

  it('formats a clear day with no precipitation', () => {
    const result = formatForecast([{ date: '2026-05-17', highF: 85, lowF: 65, code: 0, precipMm: 0 }]);
    expect(result).toBe('2026-05-17: High 85°F / Low 65°F, Clear');
  });

  it('includes precipitation when precipMm > 0', () => {
    const result = formatForecast([{ date: '2026-05-18', highF: 60, lowF: 45, code: 63, precipMm: 12.5 }]);
    expect(result).toContain('12.5mm precip');
    expect(result).toContain('Rain');
  });

  it('formats multiple days joined by newlines', () => {
    const result = formatForecast([
      { date: '2026-05-17', highF: 85, lowF: 65, code: 0, precipMm: 0 },
      { date: '2026-05-18', highF: 70, lowF: 55, code: 3, precipMm: 0 },
    ]);
    const lines = result.split('\n');
    expect(lines).toHaveLength(2);
    expect(lines[1]).toContain('Overcast');
  });

  it('labels unknown WMO codes as Unknown', () => {
    const result = formatForecast([{ date: '2026-05-17', highF: 70, lowF: 50, code: 999, precipMm: 0 }]);
    expect(result).toContain('Unknown');
  });
});
