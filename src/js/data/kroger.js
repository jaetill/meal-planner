import { API_BASE } from '../config.js';

const KROGER_STORE_KEY = 'krogerStore';

// ── Saved store ───────────────────────────────────────────

export function getSavedStore() {
  try { return JSON.parse(localStorage.getItem(KROGER_STORE_KEY)); }
  catch { return null; }
}

export function saveStore(store) {
  localStorage.setItem(KROGER_STORE_KEY, JSON.stringify(store));
}

// ── API ───────────────────────────────────────────────────

export async function fetchStores(zip) {
  const res = await fetch(`${API_BASE}/kroger/locations?zip=${encodeURIComponent(zip)}`);
  if (!res.ok) throw new Error(`Store lookup failed: ${res.status}`);
  const json = await res.json();
  return json.data || [];
}

export async function fetchProducts(term, locationId) {
  let url = `${API_BASE}/kroger/products?q=${encodeURIComponent(term)}`;
  if (locationId) url += `&locationId=${encodeURIComponent(locationId)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Product search failed: ${res.status}`);
  const json = await res.json();
  return json.data || [];
}
