// Regression tests for issue #67 — parseIngredientLine Unicode fraction handling.
// Verifies that real Unicode fraction characters (½ ¼ ¾ ⅓ ⅔) are correctly parsed
// after the PR #65 regex fix. parse-utils.js is a pure module (no AWS deps) so no
// mocking is needed.

import { describe, it, expect } from 'vitest';
import { parseIngredientLine } from '../lambda/lib/parse-utils.js';

describe('parseIngredientLine — Unicode fraction quantities', () => {
  it('parses "½ cup flour"', () => {
    expect(parseIngredientLine('½ cup flour')).toMatchObject({
      quantity: '½',
      unit: 'cup',
      name: 'flour',
    });
  });

  it('parses "¼ tsp salt"', () => {
    expect(parseIngredientLine('¼ tsp salt')).toMatchObject({
      quantity: '¼',
      unit: 'tsp',
      name: 'salt',
    });
  });

  it('parses "⅓ cup sugar"', () => {
    expect(parseIngredientLine('⅓ cup sugar')).toMatchObject({
      quantity: '⅓',
      unit: 'cup',
      name: 'sugar',
    });
  });

  it('parses "¾ cup milk"', () => {
    expect(parseIngredientLine('¾ cup milk')).toMatchObject({
      quantity: '¾',
      unit: 'cup',
      name: 'milk',
    });
  });

  it('parses "⅔ cup buttermilk"', () => {
    expect(parseIngredientLine('⅔ cup buttermilk')).toMatchObject({
      quantity: '⅔',
      unit: 'cup',
      name: 'buttermilk',
    });
  });
});

describe('parseIngredientLine — numeric quantity without unit', () => {
  it('extracts quantity from "2 cloves garlic"', () => {
    expect(parseIngredientLine('2 cloves garlic')).toMatchObject({
      quantity: '2',
      unit: 'clove',
      name: 'garlic',
    });
  });

  it('extracts quantity from unitless line "2 eggs"', () => {
    expect(parseIngredientLine('2 eggs')).toMatchObject({
      quantity: '2',
      unit: '',
      name: 'eggs',
    });
  });

  it('returns empty quantity for bare ingredient "salt"', () => {
    expect(parseIngredientLine('salt')).toMatchObject({
      quantity: '',
      unit: '',
      name: 'salt',
    });
  });
});

describe('parseIngredientLine — preparation extraction', () => {
  it('splits comma-separated preparation from "1 cup onions, chopped"', () => {
    expect(parseIngredientLine('1 cup onions, chopped')).toMatchObject({
      quantity: '1',
      unit: 'cup',
      name: 'onions',
      preparation: 'chopped',
    });
  });

  it('strips filler prep phrases like "to taste"', () => {
    expect(parseIngredientLine('1 tsp salt, to taste')).toMatchObject({
      name: 'salt',
      preparation: '',
    });
  });
});
