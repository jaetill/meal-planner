// Regression tests for issue #28 — UTF-8 encoding corruption in save.js.
// Verifies that decodeHtml() and parseDurationFromText() handle Unicode
// fractions, en-dash, em-dash, degree, and ellipsis correctly.
//
// parse-utils.js is a pure module (no AWS/Sentry deps) so no mocking needed.

import { describe, it, expect } from 'vitest';
import { decodeHtml, parseDurationFromText } from '../lambda/lib/parse-utils.js';

describe('decodeHtml — HTML entity decoding', () => {
  it('decodes &frac12; to ½', () => {
    expect(decodeHtml('&frac12; cup')).toBe('½ cup');
  });
  it('decodes &frac14; to ¼', () => {
    expect(decodeHtml('&frac14; tsp')).toBe('¼ tsp');
  });
  it('decodes &frac34; to ¾', () => {
    expect(decodeHtml('&frac34; lb')).toBe('¾ lb');
  });
  it('decodes &deg; to °', () => {
    expect(decodeHtml('350&deg;F')).toBe('350°F');
  });
  it('decodes &mdash; to —', () => {
    expect(decodeHtml('salt&mdash;pepper')).toBe('salt—pepper');
  });
  it('decodes &ndash; to –', () => {
    expect(decodeHtml('steps 1&ndash;3')).toBe('steps 1–3');
  });
  it('decodes &hellip; to …', () => {
    expect(decodeHtml('simmer&hellip;')).toBe('simmer…');
  });
});

describe('parseDurationFromText — range with en-dash', () => {
  it('parses "10–20 minutes" (en-dash) → { min: 600, max: 1200 }', () => {
    expect(parseDurationFromText('10–20 minutes')).toEqual({ min: 600, max: 1200 });
  });
  it('parses "5-10 minutes" (hyphen) → { min: 300, max: 600 }', () => {
    expect(parseDurationFromText('5-10 minutes')).toEqual({ min: 300, max: 600 });
  });
  it('parses "30 minutes" → { min: 1800 }', () => {
    expect(parseDurationFromText('30 minutes')).toEqual({ min: 1800 });
  });
  it('returns null when no duration is present', () => {
    expect(parseDurationFromText('stir until smooth')).toBeNull();
  });
});
