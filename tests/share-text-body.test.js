// Regression test for issue #29 — bullet character U+2022 (•) was mojibake-encoded
// to â€¢ in buildTextBody(), corrupting ingredient lists in outgoing recipe emails.
//
// buildTextBody is a pure module (no AWS/Sentry deps) so no mocking needed.

import { describe, it, expect } from 'vitest';
import { buildTextBody } from '../lambda/lib/share-utils.js';

describe('buildTextBody — ingredient bullet character', () => {
  it('renders each ingredient with a • bullet (U+2022)', () => {
    const result = buildTextBody({
      name: 'Test Recipe',
      ingredients: [{ name: 'flour', quantity: '1', unit: 'cup' }],
    });
    expect(result).toContain('  • 1 cup flour');
  });

  it('does not contain mojibake â€¢ in output', () => {
    const result = buildTextBody({
      name: 'Test Recipe',
      ingredients: [{ name: 'butter', quantity: '2', unit: 'tbsp' }],
    });
    expect(result).not.toContain('â€¢');
  });

  it('handles ingredients with preparation note', () => {
    const result = buildTextBody({
      name: 'Test Recipe',
      ingredients: [{ name: 'garlic', preparation: 'minced', quantity: '3', unit: 'cloves' }],
    });
    expect(result).toContain('  • 3 cloves garlic, minced');
  });

  it('includes recipe name, section headers, and directions', () => {
    const result = buildTextBody({
      name: 'My Recipe',
      ingredients: [{ name: 'salt' }],
      directions: [{ text: 'Mix everything.' }],
    });
    expect(result).toContain('My Recipe');
    expect(result).toContain('Ingredients:');
    expect(result).toContain('Directions:');
    expect(result).toContain('1. Mix everything.');
  });
});
