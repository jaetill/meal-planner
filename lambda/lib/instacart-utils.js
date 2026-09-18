// Pure helpers for the Instacart Developer Platform (IDP) handoff.
// No AWS / network deps so this can be unit-tested directly.
//
// IDP contract (docs.instacart.com/developer_platform_api):
//   POST /idp/v1/products/products_link  → { products_link_url }
//   GET  /idp/v1/retailers?postal_code=&country_code=US → { retailers: [{ retailer_key, name, retailer_logo_url }] }
// Appending ?retailer_key=<key> to the returned link pre-selects the store.

'use strict';

// Units IDP documents as accepted (full words). Anything else is dropped and
// the item falls back to "each" — Instacart's product matcher does better with
// a bare name than with a unit it doesn't understand.
const UNIT_MAP = {
  cup: 'cup',
  cups: 'cup',
  tbsp: 'tablespoon',
  tablespoon: 'tablespoon',
  tablespoons: 'tablespoon',
  tsp: 'teaspoon',
  teaspoon: 'teaspoon',
  teaspoons: 'teaspoon',
  oz: 'ounce',
  ounce: 'ounce',
  ounces: 'ounce',
  lb: 'pound',
  lbs: 'pound',
  pound: 'pound',
  pounds: 'pound',
  g: 'gram',
  gram: 'gram',
  grams: 'gram',
  kg: 'kilogram',
  kilogram: 'kilogram',
  kilograms: 'kilogram',
  ml: 'milliliter',
  milliliter: 'milliliter',
  milliliters: 'milliliter',
  l: 'liter',
  liter: 'liter',
  liters: 'liter',
  pkg: 'package',
  package: 'package',
  packages: 'package',
  each: 'each',
};

// Countable units that don't exist in IDP but still mean "N of the thing".
// Quantity is kept; unit becomes "each".
const COUNT_UNITS = new Set([
  'can',
  'cans',
  'clove',
  'cloves',
  'head',
  'heads',
  'bunch',
  'bunches',
  'stalk',
  'stalks',
  'piece',
  'pieces',
  'slice',
  'slices',
  'sprig',
  'sprigs',
]);

const MAX_ITEMS = 250; // IDP hard limit is higher; this is a sanity cap

/** Bad client input — the handler maps this to a 400 (anything else is a 502). */
class ValidationError extends Error {
  constructor(msg) {
    super(msg);
    this.name = 'ValidationError';
    this.statusCode = 400;
  }
}

function cleanName(name) {
  return String(name || '')
    .replace(/\(.*?\)/g, '') // "(optional)", "(about 2 lbs)"
    .replace(/\s+/g, ' ')
    .trim();
}

function toLineItem(item) {
  if (!item || typeof item !== 'object') return null;
  const name = cleanName(item.name);
  if (!name) return null;

  const rawUnit = String(item.unit || '')
    .toLowerCase()
    .trim();
  const qty = Number(item.quantity);
  const hasQty = Number.isFinite(qty) && qty > 0;

  const line = { name };

  if (UNIT_MAP[rawUnit]) {
    line.unit = UNIT_MAP[rawUnit];
    if (hasQty) line.quantity = round2(qty);
  } else if (COUNT_UNITS.has(rawUnit) || !rawUnit) {
    line.unit = 'each';
    if (hasQty) line.quantity = Math.max(1, Math.ceil(qty));
  } else {
    // Unknown measure (pinch, dash, large, "to taste"…) — keep a real count if
    // there is one, otherwise a single "each".
    line.unit = 'each';
    line.quantity = hasQty ? Math.max(1, Math.ceil(qty)) : 1;
  }

  if (item.preparation) line.display_text = `${name}, ${item.preparation}`;
  return line;
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

/**
 * Build the products_link request body.
 * @param {{ title?: string, items: Array<{name, quantity?, unit?, preparation?}>, linkbackUrl?: string }} opts
 */
function buildShoppingListPayload({ title, items, linkbackUrl }) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new ValidationError('items must be a non-empty array');
  }
  if (items.length > MAX_ITEMS) {
    throw new ValidationError(`too many items (max ${MAX_ITEMS})`);
  }

  // Merge duplicates (e.g. a staple and a recipe ingredient with the same
  // name+unit) by summing quantities rather than dropping one.
  const byKey = new Map();
  for (const item of items) {
    const line = toLineItem(item);
    if (!line) continue;
    const key = `${line.name.toLowerCase()}|${line.unit}`;
    const prev = byKey.get(key);
    if (prev) {
      if (prev.quantity != null || line.quantity != null) {
        prev.quantity = round2((prev.quantity ?? 0) + (line.quantity ?? 0));
      }
    } else {
      byKey.set(key, line);
    }
  }
  const line_items = [...byKey.values()];
  if (line_items.length === 0) throw new ValidationError('no usable items');

  const payload = {
    title: String(title || 'Meal Planner groceries').slice(0, 100),
    link_type: 'shopping_list',
    line_items,
  };
  if (linkbackUrl) {
    payload.landing_page_configuration = { partner_linkback_url: linkbackUrl };
  }
  return payload;
}

/** Append retailer_key so the Instacart page opens on the chosen store. */
function withRetailer(url, retailerKey) {
  if (!retailerKey) return url;
  const u = new URL(url);
  u.searchParams.set('retailer_key', retailerKey);
  return u.toString();
}

module.exports = {
  buildShoppingListPayload,
  withRetailer,
  toLineItem,
  cleanName,
  ValidationError,
  MAX_ITEMS,
};
