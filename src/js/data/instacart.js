import { API_BASE } from '../config.js';
import { getIdToken } from '../auth.js';

// Instacart delivery handoff. The Lambda holds the API key; the browser only
// ever sees the finished shopping-list URL.
//
// POST /instacart is on the public HTTP API but behind a Cognito JWT
// authorizer — the ID token goes in the Authorization header as a Bearer.

const INSTACART_URL = `${API_BASE}/instacart`;
const RETAILER_KEY = 'instacartRetailer';

// ── Saved retailer (per browser, like the Kroger store) ───────

export function getSavedRetailer() {
  try {
    return JSON.parse(localStorage.getItem(RETAILER_KEY));
  } catch {
    return null;
  }
}

export function saveRetailer(retailer) {
  if (retailer) localStorage.setItem(RETAILER_KEY, JSON.stringify(retailer));
  else localStorage.removeItem(RETAILER_KEY);
}

// ── API ───────────────────────────────────────────────────────

async function post(body) {
  const res = await fetch(INSTACART_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getIdToken()}` },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Instacart request failed: ${res.status}`);
  }
  return res.json();
}

/** @returns {Promise<Array<{retailer_key, name, logo}>>} */
export async function fetchRetailers(zip) {
  const json = await post({ action: 'retailers', zip });
  return json.retailers || [];
}

/**
 * Create a pre-filled Instacart shopping list and return its URL.
 * @param {{ title: string, items: Array<{name, quantity, unit, preparation}>, retailerKey?: string }} opts
 */
export async function createShoppingList({ title, items, retailerKey }) {
  const json = await post({ action: 'list', title, items, retailerKey });
  return json.url;
}
