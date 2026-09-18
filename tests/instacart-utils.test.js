// Instacart handoff — pure payload builder (lambda/lib/instacart-utils.js).
// Guards the recipe-ingredient → IDP line_item translation, which is the
// piece most likely to silently produce bad product matches.

import { describe, it, expect } from 'vitest';
import {
  buildShoppingListPayload,
  withRetailer,
  toLineItem,
  cleanName,
  ValidationError,
} from '../lambda/lib/instacart-utils.js';

describe('toLineItem — unit translation', () => {
  it('maps abbreviations to IDP full-word units and keeps fractional qty', () => {
    expect(toLineItem({ name: 'flour', quantity: 1.5, unit: 'cups' })).toEqual({
      name: 'flour',
      unit: 'cup',
      quantity: 1.5,
    });
    expect(toLineItem({ name: 'butter', quantity: 2, unit: 'tbsp' })).toMatchObject({
      unit: 'tablespoon',
      quantity: 2,
    });
    expect(toLineItem({ name: 'chicken', quantity: 1.25, unit: 'lb' })).toMatchObject({
      unit: 'pound',
      quantity: 1.25,
    });
  });

  it('turns countable non-IDP units into "each" with a whole-number ceiling', () => {
    expect(toLineItem({ name: 'garlic', quantity: 2.4, unit: 'cloves' })).toEqual({
      name: 'garlic',
      unit: 'each',
      quantity: 3,
    });
    expect(toLineItem({ name: 'black beans', quantity: 1, unit: 'can' })).toMatchObject({
      unit: 'each',
      quantity: 1,
    });
  });

  it('sends unknown measures (pinch, to taste) as a single "each"', () => {
    expect(toLineItem({ name: 'salt', quantity: 1, unit: 'pinch' })).toEqual({
      name: 'salt',
      unit: 'each',
      quantity: 1,
    });
  });

  it('defaults to each when no unit, keeping the quantity', () => {
    expect(toLineItem({ name: 'eggs', quantity: 6 })).toEqual({
      name: 'eggs',
      unit: 'each',
      quantity: 6,
    });
  });

  it('omits quantity when it is missing or zero but a real unit is given', () => {
    const line = toLineItem({ name: 'olive oil', unit: 'tbsp' });
    expect(line).toEqual({ name: 'olive oil', unit: 'tablespoon' });
  });

  it('puts preparation in display_text so the search term stays clean', () => {
    const line = toLineItem({ name: 'onion', quantity: 1, unit: '', preparation: 'diced' });
    expect(line.name).toBe('onion');
    expect(line.display_text).toBe('onion, diced');
  });

  it('returns null for blank names and non-object entries', () => {
    expect(toLineItem({ name: '   ' })).toBeNull();
    expect(toLineItem(null)).toBeNull();
    expect(toLineItem('onion')).toBeNull();
  });

  it('keeps a real count for unknown units like "large"', () => {
    expect(toLineItem({ name: 'eggs', quantity: 3, unit: 'large' })).toEqual({
      name: 'eggs',
      unit: 'each',
      quantity: 3,
    });
  });

  it('treats non-numeric quantity strings as no quantity', () => {
    expect(toLineItem({ name: 'rice', quantity: '1/2', unit: 'cup' })).toEqual({
      name: 'rice',
      unit: 'cup',
    });
    expect(toLineItem({ name: 'garlic', quantity: 'some', unit: 'cloves' })).toEqual({
      name: 'garlic',
      unit: 'each',
    });
  });
});

describe('cleanName', () => {
  it('strips parentheticals and squashes whitespace', () => {
    expect(cleanName('chicken thighs  (about 2 lbs)')).toBe('chicken thighs');
  });
});

describe('buildShoppingListPayload', () => {
  const items = [
    { name: 'flour', quantity: 2, unit: 'cups' },
    { name: 'Flour', quantity: 1, unit: 'cup' }, // duplicate after normalization
    { name: 'eggs', quantity: 3 },
  ];

  it('builds a shopping_list payload and merges duplicates by summing quantity', () => {
    const p = buildShoppingListPayload({ title: 'Week of Sep 21', items });
    expect(p.link_type).toBe('shopping_list');
    expect(p.title).toBe('Week of Sep 21');
    expect(p.line_items).toHaveLength(2);
    expect(p.line_items[0]).toEqual({ name: 'flour', unit: 'cup', quantity: 3 });
    expect(p.line_items[1].name).toBe('eggs');
  });

  it('skips null entries instead of throwing', () => {
    const p = buildShoppingListPayload({ items: [null, { name: 'milk' }] });
    expect(p.line_items).toEqual([{ name: 'milk', unit: 'each' }]);
  });

  it('throws ValidationError (statusCode 400) on bad input', () => {
    let err;
    try {
      buildShoppingListPayload({ items: [] });
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(ValidationError);
    expect(err.statusCode).toBe(400);
  });

  it('adds linkback configuration only when a URL is provided', () => {
    expect(buildShoppingListPayload({ items }).landing_page_configuration).toBeUndefined();
    expect(
      buildShoppingListPayload({ items, linkbackUrl: 'https://meals.jaetill.com' })
        .landing_page_configuration,
    ).toEqual({ partner_linkback_url: 'https://meals.jaetill.com' });
  });

  it('falls back to a default title and caps its length', () => {
    expect(buildShoppingListPayload({ items }).title).toBe('Meal Planner groceries');
    expect(buildShoppingListPayload({ items, title: 'x'.repeat(200) }).title).toHaveLength(100);
  });

  it('rejects empty, oversized, or all-blank item lists', () => {
    expect(() => buildShoppingListPayload({ items: [] })).toThrow(/non-empty/);
    expect(() =>
      buildShoppingListPayload({ items: Array.from({ length: 251 }, () => ({ name: 'x' })) }),
    ).toThrow(/too many/);
    expect(() => buildShoppingListPayload({ items: [{ name: '' }] })).toThrow(/no usable/);
  });
});

describe('withRetailer', () => {
  it('appends retailer_key to the products link', () => {
    expect(withRetailer('https://www.instacart.com/store/shopping_lists/123', 'aldi')).toBe(
      'https://www.instacart.com/store/shopping_lists/123?retailer_key=aldi',
    );
  });

  it('preserves existing query params and returns the url untouched without a key', () => {
    const url = 'https://www.instacart.com/store/shopping_lists/123?utm=x';
    expect(withRetailer(url, 'aldi')).toBe(`${url}&retailer_key=aldi`);
    expect(withRetailer(url, '')).toBe(url);
  });
});
