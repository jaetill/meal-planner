import { recipes, mealPlans, saveMealPlans, saveRecipes, staples, saveStaples, aisleOrders, saveAisleOrders } from '../data/index.js';
import { getSavedStore, saveStore, fetchStores, fetchProducts } from '../data/kroger.js';
import { btn } from '../ui/elements.js';
import { toastError } from '../ui/toast.js';

// ── Date helpers ───────────────────────────────────────────

function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function toDateKey(date) {
  return date.toISOString().slice(0, 10);
}

function toInputValue(date) {
  // Local date string for <input type="date"> — avoid UTC shift
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function fromInputValue(str) {
  // Parse "YYYY-MM-DD" as local date
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function fmtDate(date) {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function fmtDayHeading(dateKey) {
  const [y, m, d] = dateKey.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

// ── Quantity math ──────────────────────────────────────────

function parseQty(str) {
  if (!str) return 0;
  str = str.trim();
  const mixed = str.match(/^(\d+)\s+(\d+)\/(\d+)$/);
  if (mixed) return parseInt(mixed[1]) + parseInt(mixed[2]) / parseInt(mixed[3]);
  const frac = str.match(/^(\d+)\/(\d+)$/);
  if (frac) return parseInt(frac[1]) / parseInt(frac[2]);
  const num = parseFloat(str);
  return isNaN(num) ? 0 : num;
}

function formatQty(num) {
  if (num === 0) return '';
  const whole = Math.floor(num);
  const frac = num - whole;
  const fracs = [[0.25, '¼'], [0.333, '⅓'], [0.5, '½'], [0.667, '⅔'], [0.75, '¾']];
  for (const [val, sym] of fracs) {
    if (Math.abs(frac - val) < 0.02) return whole > 0 ? `${whole} ${sym}` : sym;
  }
  if (frac === 0) return String(whole);
  return parseFloat(num.toFixed(2)).toString();
}

// ── Aggregation ────────────────────────────────────────────

// Unit words that sometimes end up embedded at the start of ingredient names
// due to import failures (e.g. "cloves crushed garlic" instead of name="garlic" unit="clove")
const EMBEDDED_UNITS = {
  cloves: 'clove', clove: 'clove', cups: 'cup', cup: 'cup',
  tablespoons: 'tbsp', tablespoon: 'tbsp', teaspoons: 'tsp', teaspoon: 'tsp',
  ounces: 'oz', ounce: 'oz', pounds: 'lb', pound: 'lb', lbs: 'lb',
  grams: 'g', gram: 'g', cans: 'can', can: 'can',
  packages: 'pkg', package: 'pkg', slices: 'slice', slice: 'slice',
  pieces: 'piece', piece: 'piece', sprigs: 'sprig', sprig: 'sprig',
  bunches: 'bunch', bunch: 'bunch', stalks: 'stalk', stalk: 'stalk',
  heads: 'head', head: 'head', pinches: 'pinch', pinch: 'pinch',
};

function normalizeIngredient(name, unit) {
  if (unit) return { name, unit };
  const words = name.trim().split(/\s+/);
  if (words.length > 1) {
    const extracted = EMBEDDED_UNITS[words[0].toLowerCase()];
    if (extracted) return { name: words.slice(1).join(' '), unit: extracted };
  }
  return { name, unit: '' };
}

function buildGroceryList(dateKeys, defaultServings) {
  const rangeEntries = mealPlans.filter(e => dateKeys.includes(e.date));

  // key: "name|unit" → aggregated item
  const map = new Map();

  for (const entry of rangeEntries) {
    // Plain items (no recipe, just a text label like "filet mignon")
    if (entry.plainText) {
      const name = entry.plainText;
      const key  = `${name.toLowerCase().trim()}|`;
      if (!map.has(key)) {
        map.set(key, { name, unit: '', preparation: '', section: '', totalQty: 0, rawQty: '' });
      }
      continue;
    }

    const recipe = recipes.find(r => r.id === entry.recipeId);
    if (!recipe) continue;

    const desired = entry.servings ?? defaultServings;
    const scale   = desired / (recipe.servings || 1);

    for (const ing of (recipe.ingredients || [])) {
      if (!ing.quantity && !ing.unit) continue; // skip group header rows

      const { name, unit } = normalizeIngredient(ing.name, ing.unit || '');
      const key       = `${name.toLowerCase().trim()}|${unit.toLowerCase().trim()}`;
      const scaledQty = parseQty(ing.quantity) * scale;

      if (map.has(key)) {
        map.get(key).totalQty += scaledQty;
      } else {
        map.set(key, {
          name, unit,
          preparation: ing.preparation || '',
          section:     ing.section || '',
          totalQty:    scaledQty,
          rawQty:      ing.quantity || '',
        });
      }
    }
  }

  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
}

// ── Servings stepper ───────────────────────────────────────

function makeServingsStepper(initial, onChange) {
  let value = Math.max(1, initial || 1);

  const wrap = document.createElement('div');
  wrap.className = 'flex items-center gap-1.5';

  const minus = btn('−', 'secondary');
  minus.className = 'w-7 h-7 p-0 text-center text-sm leading-none';

  const display = document.createElement('span');
  display.className = 'w-6 text-center text-sm font-semibold text-gray-800';
  display.textContent = value;

  const plus = btn('+', 'secondary');
  plus.className = 'w-7 h-7 p-0 text-center text-sm leading-none';

  minus.onclick = () => { if (value > 1) { value--; display.textContent = value; onChange(value); } };
  plus.onclick  = () => { value++; display.textContent = value; onChange(value); };

  wrap.appendChild(minus);
  wrap.appendChild(display);
  wrap.appendChild(plus);
  return wrap;
}

// ── Config sheet ───────────────────────────────────────────

function showConfigSheet({ startDate, endDate, defaultServings, onApply }) {
  const overlay = document.createElement('div');
  overlay.className = 'fixed inset-0 bg-black/40 z-40 flex items-end justify-center pb-16';

  const sheet = document.createElement('div');
  sheet.className = 'bg-white w-full max-w-2xl rounded-t-2xl p-4 max-h-[85vh] flex flex-col';

  // Header
  const header = document.createElement('div');
  header.className = 'flex items-center justify-between mb-4';
  const title = document.createElement('span');
  title.className = 'font-bold text-gray-800';
  title.textContent = 'Shopping settings';
  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.textContent = '×';
  closeBtn.className = 'text-gray-400 text-2xl leading-none';
  closeBtn.onclick = () => overlay.remove();
  header.appendChild(title);
  header.appendChild(closeBtn);
  sheet.appendChild(header);

  const scrollArea = document.createElement('div');
  scrollArea.className = 'overflow-y-auto flex-1 space-y-5';

  // ── Date range ────────────────────────────────────────
  let draftStart = new Date(startDate);
  let draftEnd   = new Date(endDate);

  const dateSection = document.createElement('div');
  const dateLabel = document.createElement('div');
  dateLabel.className = 'text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2';
  dateLabel.textContent = 'Date range';
  dateSection.appendChild(dateLabel);

  const dateRow = document.createElement('div');
  dateRow.className = 'flex items-center gap-2';

  const startInput = document.createElement('input');
  startInput.type = 'date';
  startInput.className = 'field flex-1';
  startInput.value = toInputValue(draftStart);

  const dateSep = document.createElement('span');
  dateSep.className = 'text-gray-400 text-sm shrink-0';
  dateSep.textContent = 'to';

  const endInput = document.createElement('input');
  endInput.type = 'date';
  endInput.className = 'field flex-1';
  endInput.value = toInputValue(draftEnd);
  endInput.min = toInputValue(draftStart);

  startInput.onchange = () => {
    draftStart = fromInputValue(startInput.value);
    endInput.min = startInput.value;
    if (draftEnd < draftStart) {
      draftEnd = new Date(draftStart);
      endInput.value = startInput.value;
    }
    refreshMealRows();
  };
  endInput.onchange = () => {
    draftEnd = fromInputValue(endInput.value);
    refreshMealRows();
  };

  dateRow.appendChild(startInput);
  dateRow.appendChild(dateSep);
  dateRow.appendChild(endInput);
  dateSection.appendChild(dateRow);
  scrollArea.appendChild(dateSection);

  // ── Default servings ──────────────────────────────────
  let draftDefault = defaultServings;

  const defaultSection = document.createElement('div');
  const defaultLabel = document.createElement('div');
  defaultLabel.className = 'text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2';
  defaultLabel.textContent = 'Default servings';
  defaultSection.appendChild(defaultLabel);

  const defaultRow = document.createElement('div');
  defaultRow.className = 'flex items-center justify-between';
  const defaultDesc = document.createElement('span');
  defaultDesc.className = 'text-sm text-gray-600';
  defaultDesc.textContent = 'Cook for how many people?';
  const defaultStepper = makeServingsStepper(draftDefault, v => {
    draftDefault = v;
    refreshMealRows(); // update any rows still showing the default
  });
  defaultRow.appendChild(defaultDesc);
  defaultRow.appendChild(defaultStepper);
  defaultSection.appendChild(defaultRow);
  scrollArea.appendChild(defaultSection);

  // ── Per-meal servings ─────────────────────────────────
  const mealSection = document.createElement('div');
  const mealLabel = document.createElement('div');
  mealLabel.className = 'text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2';
  mealLabel.textContent = 'Per-meal servings';
  mealSection.appendChild(mealLabel);

  const mealList = document.createElement('div');
  mealList.className = 'space-y-2';
  mealSection.appendChild(mealList);
  scrollArea.appendChild(mealSection);

  // Track per-entry draft servings: entryId → number
  const draftServings = new Map();

  function refreshMealRows() {
    mealList.innerHTML = '';

    const keys = [];
    const d = new Date(draftStart);
    while (d <= draftEnd) { keys.push(toDateKey(d)); d.setDate(d.getDate() + 1); }

    const entries = mealPlans.filter(e => keys.includes(e.date))
      .sort((a, b) => a.date.localeCompare(b.date));

    if (entries.length === 0) {
      const none = document.createElement('p');
      none.className = 'text-sm text-gray-400 italic';
      none.textContent = 'No meals planned in this range.';
      mealList.appendChild(none);
      return;
    }

    let lastDate = null;
    for (const entry of entries) {
      const recipe = recipes.find(r => r.id === entry.recipeId);

      if (entry.date !== lastDate) {
        lastDate = entry.date;
        const dayHead = document.createElement('div');
        dayHead.className = 'text-xs font-semibold text-gray-500 mt-3 mb-1';
        dayHead.textContent = fmtDayHeading(entry.date);
        mealList.appendChild(dayHead);
      }

      const row = document.createElement('div');
      row.className = 'flex items-center justify-between gap-2 py-1';

      const nameEl = document.createElement('span');
      nameEl.className = 'text-sm text-gray-700 flex-1 truncate';
      nameEl.textContent = `${entry.meal} · ${recipe ? recipe.name : '(deleted recipe)'}`;

      const currentServings = draftServings.has(entry.id)
        ? draftServings.get(entry.id)
        : (entry.servings ?? draftDefault);

      const stepper = makeServingsStepper(currentServings, v => {
        draftServings.set(entry.id, v);
      });
      // Ensure map is seeded even if user never touches the stepper
      if (!draftServings.has(entry.id)) draftServings.set(entry.id, currentServings);

      row.appendChild(nameEl);
      row.appendChild(stepper);
      mealList.appendChild(row);
    }
  }

  refreshMealRows();

  // ── Store picker ──────────────────────────────────────
  const storeSection = document.createElement('div');
  const storeLabel = document.createElement('div');
  storeLabel.className = 'text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2';
  storeLabel.textContent = 'Store';
  storeSection.appendChild(storeLabel);

  let selectedStore = getSavedStore();

  const storeDisplay = document.createElement('div');
  storeDisplay.className = 'space-y-2';

  function renderStoreDisplay() {
    storeDisplay.innerHTML = '';

    if (selectedStore) {
      const row = document.createElement('div');
      row.className = 'flex items-center justify-between';

      const nameEl = document.createElement('span');
      nameEl.className = 'text-sm text-gray-700';
      nameEl.textContent = selectedStore.name.replace(/^(Kroger|Harris Teeter)\s*-\s*/i, '');

      const chainEl = document.createElement('span');
      chainEl.className = 'text-xs text-gray-400 ml-1';
      chainEl.textContent = `· ${selectedStore.city}, ${selectedStore.state}`;

      const changeBtn = btn('Change', 'secondary');
      changeBtn.className += ' text-xs py-1 px-2';
      changeBtn.onclick = () => { selectedStore = null; renderStoreDisplay(); };

      const nameWrap = document.createElement('span');
      nameWrap.appendChild(nameEl);
      nameWrap.appendChild(chainEl);
      row.appendChild(nameWrap);
      row.appendChild(changeBtn);
      storeDisplay.appendChild(row);
      return;
    }

    // Zip input + search
    const searchRow = document.createElement('div');
    searchRow.className = 'flex gap-2';

    const zipInput = document.createElement('input');
    zipInput.type = 'text';
    zipInput.placeholder = 'ZIP code';
    zipInput.maxLength = 5;
    zipInput.className = 'field flex-1';
    zipInput.value = localStorage.getItem('krogerZip') || '';

    const searchBtn = btn('Find stores', 'secondary');
    searchBtn.className += ' shrink-0 text-sm';

    const resultsList = document.createElement('div');
    resultsList.className = 'space-y-1 mt-1';

    async function doSearch() {
      const zip = zipInput.value.trim();
      if (!/^\d{5}$/.test(zip)) { resultsList.innerHTML = '<p class="text-xs text-red-500">Enter a 5-digit ZIP.</p>'; return; }
      localStorage.setItem('krogerZip', zip);
      searchBtn.disabled = true;
      searchBtn.textContent = 'Searching…';
      resultsList.innerHTML = '';
      try {
        const stores = await fetchStores(zip);
        searchBtn.disabled = false;
        searchBtn.textContent = 'Find stores';
        if (stores.length === 0) {
          resultsList.innerHTML = '<p class="text-xs text-gray-400">No stores found nearby.</p>';
          return;
        }
        for (const store of stores) {
          const storeBtn = document.createElement('button');
          storeBtn.type = 'button';
          storeBtn.className = 'w-full text-left text-sm px-3 py-2 rounded-lg border border-gray-100 hover:border-green-400 hover:bg-green-50 transition-colors';
          const displayName = store.name.replace(/^(Kroger|Harris Teeter)\s*-\s*/i, '');
          storeBtn.innerHTML = `<span class="font-medium text-gray-800">${displayName}</span><span class="text-xs text-gray-400 ml-2">${store.address?.city}, ${store.address?.state}</span>`;
          storeBtn.onclick = () => {
            selectedStore = {
              locationId: store.locationId,
              name:       store.name,
              city:       store.address?.city || '',
              state:      store.address?.state || '',
            };
            saveStore(selectedStore);
            renderStoreDisplay();
          };
          resultsList.appendChild(storeBtn);
        }
      } catch {
        searchBtn.disabled = false;
        searchBtn.textContent = 'Find stores';
        resultsList.innerHTML = '<p class="text-xs text-red-500">Could not load stores. Try again.</p>';
      }
    }

    searchBtn.onclick = doSearch;
    zipInput.onkeydown = e => { if (e.key === 'Enter') doSearch(); };

    searchRow.appendChild(zipInput);
    searchRow.appendChild(searchBtn);
    storeDisplay.appendChild(searchRow);
    storeDisplay.appendChild(resultsList);
  }

  renderStoreDisplay();
  storeSection.appendChild(storeDisplay);
  scrollArea.appendChild(storeSection);

  sheet.appendChild(scrollArea);

  // ── Apply button ──────────────────────────────────────
  const applyBtn = btn('Apply', 'primary');
  applyBtn.className += ' w-full mt-4';
  applyBtn.onclick = async () => {
    applyBtn.disabled = true;
    applyBtn.textContent = 'Saving…';

    // Persist defaultServings
    localStorage.setItem('groceryDefaultServings', String(draftDefault));

    // Apply per-meal servings overrides to mealPlans entries
    let changed = false;
    for (const [entryId, servings] of draftServings) {
      const entry = mealPlans.find(e => e.id === entryId);
      if (!entry) continue;
      if (entry.servings !== servings) {
        entry.servings = servings;
        changed = true;
      }
    }

    if (changed) {
      try {
        await saveMealPlans(mealPlans);
      } catch {
        toastError('Could not save settings. Try again.');
        applyBtn.disabled = false;
        applyBtn.textContent = 'Apply';
        return;
      }
    }

    overlay.remove();
    onApply({ startDate: draftStart, endDate: draftEnd, defaultServings: draftDefault });
  };

  sheet.appendChild(applyBtn);
  overlay.appendChild(sheet);
  overlay.onclick = e => { if (e.target === overlay) overlay.remove(); };
  document.body.appendChild(overlay);
}

// ── Recipe cost estimation ─────────────────────────────────

const EMA_ALPHA = 0.3;

async function updateRecipeCosts(dateKeys, locationId) {
  const usedIds = new Set(
    mealPlans.filter(e => dateKeys.includes(e.date)).map(e => e.recipeId)
  );

  let changed = false;

  for (const id of usedIds) {
    const recipe = recipes.find(r => r.id === id);
    if (!recipe) continue;

    let total = 0;
    for (const ing of (recipe.ingredients || [])) {
      if (!ing.quantity && !ing.unit) continue; // separator rows
      const cacheKey = `${locationId}:${ing.name.toLowerCase()}`;
      const cached   = priceCache.get(cacheKey);
      if (!cached || cached.text === '–') continue;
      const val = parseFloat(cached.text.replace('$', ''));
      if (!isNaN(val)) total += val;
    }

    if (total === 0) continue;

    const newCostPerServing = total / (recipe.servings || 1);
    const prior = recipe.estimatedCostPerServing;

    recipe.estimatedCostPerServing = prior != null
      ? EMA_ALPHA * newCostPerServing + (1 - EMA_ALPHA) * prior
      : newCostPerServing;
    recipe.costSampleCount = (recipe.costSampleCount || 0) + 1;
    recipe.lastPricedAt    = new Date().toISOString();
    changed = true;
  }

  if (changed) {
    try { await saveRecipes([...recipes]); } catch { /* non-fatal */ }
  }
}

// ── Kroger data fetching ───────────────────────────────────

// Cache keys are "locationId:itemName"
const priceCache = new Map(); // → { text, promo }
const aisleCache = new Map(); // → { number, description } | null
let fetchGeneration = 0;

async function loadKrogerData(items, locationId, gen, onComplete) {
  for (const item of items) {
    if (fetchGeneration !== gen) return;
    const cacheKey = `${locationId}:${item.name.toLowerCase()}`;
    try {
      const products = await fetchProducts(item.name, locationId);

      // Lowest effective price across all results
      let minVal = Infinity, isPromo = false;
      for (const product of products) {
        for (const pItem of (product.items || [])) {
          const p = pItem.price;
          if (!p) continue;
          const val = p.promo ?? p.regular;
          if (val != null && val < minVal) { minVal = val; isPromo = !!p.promo; }
        }
      }
      priceCache.set(cacheKey, { text: minVal < Infinity ? `$${minVal.toFixed(2)}` : '–', promo: isPromo });

      // Aisle from first product that has location data
      const aisleLocation = products.find(p => p.aisleLocations?.length)?.aisleLocations[0];
      aisleCache.set(cacheKey, aisleLocation
        ? { number: aisleLocation.number, description: aisleLocation.description }
        : null);

    } catch {
      priceCache.set(cacheKey, { text: '–', promo: false });
      aisleCache.set(cacheKey, null);
    }
  }
  if (fetchGeneration === gen) onComplete();
}

// ── Aisle config helpers ───────────────────────────────────
// aisle-orders.json shape: { [locationId]: { order: string[], overrides: { [itemName]: aisleKey } } }
// Old shape was { [locationId]: string[] } — handled for backward compat.

function getAisleConfig(locationId) {
  const raw = aisleOrders[locationId];
  if (!raw) return { order: [], overrides: {} };
  if (Array.isArray(raw)) return { order: raw, overrides: {} };
  return { order: raw.order || [], overrides: raw.overrides || {} };
}

async function saveAisleConfig(locationId, config) {
  const updated = { ...aisleOrders, [locationId]: config };
  await saveAisleOrders(updated);
}

// ── Aisle reorder sheet ────────────────────────────────────

function showAisleReorderSheet(store, sortedGroups, onSave) {
  const overlay = document.createElement('div');
  overlay.className = 'fixed inset-0 bg-black/40 z-40 flex items-end justify-center pb-16';

  const sheet = document.createElement('div');
  sheet.className = 'bg-white w-full max-w-2xl rounded-t-2xl p-4 max-h-[85vh] flex flex-col';

  const header = document.createElement('div');
  header.className = 'flex items-center justify-between mb-1';
  const title = document.createElement('span');
  title.className = 'font-bold text-gray-800';
  title.textContent = 'Aisle order';
  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.textContent = '×';
  closeBtn.className = 'text-gray-400 text-2xl leading-none';
  closeBtn.onclick = () => overlay.remove();
  header.appendChild(title);
  header.appendChild(closeBtn);
  sheet.appendChild(header);

  const subtitle = document.createElement('p');
  subtitle.className = 'text-xs text-gray-400 mb-4';
  subtitle.textContent = 'Drag up/down to match how you walk the store. Saved for everyone in your group.';
  sheet.appendChild(subtitle);

  // Working copy of the order as array of group keys
  let order = sortedGroups.map(([key]) => key);

  const listEl = document.createElement('div');
  listEl.className = 'overflow-y-auto flex-1 space-y-1 mb-4';

  function renderList() {
    listEl.innerHTML = '';
    order.forEach((key, i) => {
      const [, { aisle }] = sortedGroups.find(([k]) => k === key);
      const label = aisle
        ? `Aisle ${aisle.number}${aisle.description ? ` · ${aisle.description}` : ''}`
        : 'Other';

      const row = document.createElement('div');
      row.className = 'flex items-center gap-3 px-3 py-2.5 bg-gray-50 rounded-xl';

      const labelEl = document.createElement('span');
      labelEl.className = 'flex-1 text-sm text-gray-700';
      labelEl.textContent = label;

      const upBtn = document.createElement('button');
      upBtn.type = 'button';
      upBtn.textContent = '↑';
      upBtn.className = `text-gray-400 hover:text-green-600 text-base leading-none${i === 0 ? ' invisible' : ''}`;
      upBtn.onclick = () => {
        [order[i - 1], order[i]] = [order[i], order[i - 1]];
        renderList();
      };

      const downBtn = document.createElement('button');
      downBtn.type = 'button';
      downBtn.textContent = '↓';
      downBtn.className = `text-gray-400 hover:text-green-600 text-base leading-none${i === order.length - 1 ? ' invisible' : ''}`;
      downBtn.onclick = () => {
        [order[i], order[i + 1]] = [order[i + 1], order[i]];
        renderList();
      };

      row.appendChild(labelEl);
      row.appendChild(upBtn);
      row.appendChild(downBtn);
      listEl.appendChild(row);
    });
  }

  renderList();
  sheet.appendChild(listEl);

  const saveBtn = btn('Save order', 'primary');
  saveBtn.className += ' w-full';
  saveBtn.onclick = async () => {
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving…';
    try {
      const existing = getAisleConfig(store.locationId);
      await saveAisleConfig(store.locationId, { ...existing, order });
      overlay.remove();
      onSave();
    } catch {
      saveBtn.disabled = false;
      saveBtn.textContent = 'Save order';
    }
  };
  sheet.appendChild(saveBtn);

  overlay.appendChild(sheet);
  overlay.onclick = e => { if (e.target === overlay) overlay.remove(); };
  document.body.appendChild(overlay);
}

// ── Aisle assignment sheet (per-item override) ─────────────

function showAisleAssignSheet(item, store, sortedGroups, currentGroupKey, onSave) {
  const overlay = document.createElement('div');
  overlay.className = 'fixed inset-0 bg-black/40 z-40 flex items-end justify-center pb-16';

  const sheet = document.createElement('div');
  sheet.className = 'bg-white w-full max-w-2xl rounded-t-2xl p-4 max-h-[70vh] flex flex-col';

  const header = document.createElement('div');
  header.className = 'flex items-center justify-between mb-1';
  const title = document.createElement('span');
  title.className = 'font-bold text-gray-800 truncate flex-1 mr-2';
  title.textContent = `Move "${item.name}" to…`;
  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.textContent = '×';
  closeBtn.className = 'text-gray-400 text-2xl leading-none shrink-0';
  closeBtn.onclick = () => overlay.remove();
  header.appendChild(title);
  header.appendChild(closeBtn);
  sheet.appendChild(header);

  const subtitle = document.createElement('p');
  subtitle.className = 'text-xs text-gray-400 mb-4';
  subtitle.textContent = 'Saved for everyone in your group. Fixes bad Kroger aisle data.';
  sheet.appendChild(subtitle);

  const listEl = document.createElement('div');
  listEl.className = 'overflow-y-auto flex-1 space-y-1';

  for (const [groupKey, { aisle }] of sortedGroups) {
    const isCurrent = groupKey === currentGroupKey;
    const label = aisle
      ? `Aisle ${aisle.number}${aisle.description ? ` · ${aisle.description}` : ''}`
      : 'Other';

    const row = document.createElement('button');
    row.type = 'button';
    row.className = `w-full text-left px-3 py-2.5 rounded-xl text-sm transition-colors ${
      isCurrent
        ? 'bg-green-50 text-green-700 font-medium'
        : 'bg-gray-50 text-gray-700 hover:bg-green-50 hover:text-green-700'
    }`;
    row.textContent = isCurrent ? `${label} ✓` : label;
    row.onclick = async () => {
      if (isCurrent) { overlay.remove(); return; }
      row.disabled = true;
      try {
        const config = getAisleConfig(store.locationId);
        const overrides = { ...config.overrides, [item.name.toLowerCase()]: groupKey };
        await saveAisleConfig(store.locationId, { ...config, overrides });
        overlay.remove();
        onSave();
      } catch { row.disabled = false; }
    };
    listEl.appendChild(row);
  }

  sheet.appendChild(listEl);
  overlay.appendChild(sheet);
  overlay.onclick = e => { if (e.target === overlay) overlay.remove(); };
  document.body.appendChild(overlay);
}

// ── Staples section ────────────────────────────────────────

let staplesEditMode = false;

function renderStaplesSection(container, store, checkedStaples, inAisleMode = false, onCheck = null) {
  const wrapper = document.createElement('div');
  wrapper.className = 'mt-6';

  function redraw() {
    wrapper.innerHTML = '';

    const collapsed = localStorage.getItem('staplesCollapsed') === 'true';

    // Header
    const headerRow = document.createElement('div');
    headerRow.className = 'flex items-center justify-between mb-2';

    const titleEl = document.createElement('span');
    titleEl.className = 'text-xs font-semibold text-gray-400 uppercase tracking-wide cursor-pointer select-none';
    titleEl.textContent = `Staples${staples.length ? ` (${staples.length})` : ''}`;
    titleEl.onclick = () => {
      localStorage.setItem('staplesCollapsed', String(!collapsed));
      redraw();
    };

    const rightGroup = document.createElement('div');
    rightGroup.className = 'flex items-center gap-3';

    if (!collapsed) {
      const editBtn = document.createElement('button');
      editBtn.type = 'button';
      editBtn.className = 'text-xs text-gray-400 hover:text-green-600';
      editBtn.textContent = staplesEditMode ? 'Done' : 'Edit';
      editBtn.onclick = () => { staplesEditMode = !staplesEditMode; redraw(); };
      rightGroup.appendChild(editBtn);
    }

    const chevron = document.createElement('span');
    chevron.className = 'text-xs text-gray-300 cursor-pointer select-none';
    chevron.textContent = collapsed ? '▶' : '▼';
    chevron.onclick = () => {
      localStorage.setItem('staplesCollapsed', String(!collapsed));
      redraw();
    };
    rightGroup.appendChild(chevron);

    headerRow.appendChild(titleEl);
    headerRow.appendChild(rightGroup);
    wrapper.appendChild(headerRow);

    if (collapsed) return;

    // In aisle mode, staples are shown inside their aisles — only show edit controls here
    if (inAisleMode && !staplesEditMode) {
      const note = document.createElement('p');
      note.className = 'text-xs text-gray-300 italic mb-2';
      note.textContent = 'Staples are sorted into aisles above. Tap Edit to manage the list.';
      wrapper.appendChild(note);
      return;
    }

    // Item list
    if (staples.length === 0 && !staplesEditMode) {
      const empty = document.createElement('p');
      empty.className = 'text-xs text-gray-300 italic mb-2';
      empty.textContent = 'No staples yet — tap Edit to add some.';
      wrapper.appendChild(empty);
    } else {
      const card = document.createElement('div');
      card.className = 'card divide-y divide-gray-50 mb-3';

      for (const staple of staples) {
        if (staplesEditMode) {
          const row = document.createElement('div');
          row.className = 'flex items-center gap-2 py-2.5 px-1';

          const textEl = document.createElement('span');
          textEl.className = 'text-sm text-gray-700 flex-1';
          const qtyStr = [staple.quantity, staple.unit, staple.name].filter(Boolean).join(' ');
          textEl.textContent = qtyStr;
          row.appendChild(textEl);

          const delBtn = document.createElement('button');
          delBtn.type = 'button';
          delBtn.textContent = '×';
          delBtn.className = 'text-gray-300 hover:text-red-400 text-lg leading-none shrink-0';
          delBtn.onclick = async () => {
            const updated = staples.filter(s => s.id !== staple.id);
            try {
              await saveStaples(updated);
            } catch { toastError('Could not remove staple.'); }
            redraw();
          };
          row.appendChild(delBtn);
          card.appendChild(row);
        } else {
          const fakeItem = {
            name:        staple.name,
            unit:        staple.unit || '',
            preparation: '',
            totalQty:    parseQty(staple.quantity),
            rawQty:      staple.quantity || '',
          };
          card.appendChild(makeItemRow(fakeItem, store, checkedStaples, null, onCheck));
        }
      }

      wrapper.appendChild(card);
    }

    // Add form (edit mode only)
    if (staplesEditMode) {
      const addRow = document.createElement('div');
      addRow.className = 'flex gap-2 items-center';

      const nameInput = document.createElement('input');
      nameInput.type = 'text';
      nameInput.placeholder = 'Item name';
      nameInput.className = 'field flex-1 text-sm';

      const qtyInput = document.createElement('input');
      qtyInput.type = 'text';
      qtyInput.placeholder = 'Qty';
      qtyInput.className = 'field w-14 text-sm';

      const unitInput = document.createElement('input');
      unitInput.type = 'text';
      unitInput.placeholder = 'Unit';
      unitInput.className = 'field w-16 text-sm';

      const addBtn = btn('+ Add', 'secondary');
      addBtn.className += ' text-sm shrink-0';

      async function doAdd() {
        const name = nameInput.value.trim();
        if (!name) return;
        const newStaple = {
          id:       crypto.randomUUID(),
          name,
          quantity: qtyInput.value.trim(),
          unit:     unitInput.value.trim(),
        };
        try {
          await saveStaples([...staples, newStaple]);
          nameInput.value = '';
          qtyInput.value  = '';
          unitInput.value = '';
          nameInput.focus();
        } catch { toastError('Could not save staple.'); }
        redraw();
      }

      addBtn.onclick = doAdd;
      nameInput.onkeydown = e => { if (e.key === 'Enter') doAdd(); };

      addRow.appendChild(nameInput);
      addRow.appendChild(qtyInput);
      addRow.appendChild(unitInput);
      addRow.appendChild(addBtn);
      wrapper.appendChild(addRow);
    }
  }

  redraw();
  container.appendChild(wrapper);
}

// ── Main render ────────────────────────────────────────────

export function renderGroceryList() {
  const container = document.getElementById('app-content');
  container.innerHTML = '';

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let startDate       = today;
  let endDate         = addDays(today, 6);
  let defaultServings = parseInt(localStorage.getItem('groceryDefaultServings')) || 4;

  const checked        = new Set(JSON.parse(localStorage.getItem('groceryChecked') || '[]'));
  const checkedStaples = new Set(JSON.parse(localStorage.getItem('groceryCheckedStaples') || '[]'));

  function persistChecked() {
    localStorage.setItem('groceryChecked', JSON.stringify([...checked]));
    localStorage.setItem('groceryCheckedStaples', JSON.stringify([...checkedStaples]));
  }

  function render() {
    container.innerHTML = '';

    // Header
    const headerRow = document.createElement('div');
    headerRow.className = 'flex items-center justify-between mb-4';

    const rangePill = document.createElement('span');
    rangePill.className = 'text-sm font-semibold text-gray-700';
    const sameYear = startDate.getFullYear() === endDate.getFullYear();
    const endFmt = endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: sameYear ? undefined : 'numeric' });
    rangePill.textContent = `${fmtDate(startDate)} – ${endFmt}`;

    const settingsBtn = btn('⚙', 'ghost');
    settingsBtn.title = 'Shopping settings';
    settingsBtn.onclick = () => showConfigSheet({
      startDate,
      endDate,
      defaultServings,
      onApply: (updated) => {
        startDate       = updated.startDate;
        endDate         = updated.endDate;
        defaultServings = updated.defaultServings;
        checked.clear(); checkedStaples.clear();
        persistChecked();
        render();
      },
    });

    headerRow.appendChild(rangePill);
    headerRow.appendChild(settingsBtn);
    container.appendChild(headerRow);

    const keys = [];
    const d = new Date(startDate);
    while (d <= endDate) { keys.push(toDateKey(d)); d.setDate(d.getDate() + 1); }

    const items = buildGroceryList(keys, defaultServings);

    if (items.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'text-gray-400 text-sm text-center py-16';
      empty.textContent = 'No meals planned in this date range.';
      container.appendChild(empty);
      return;
    }

    const store = getSavedStore();

    // Summary row
    const summaryRow = document.createElement('div');
    summaryRow.className = 'flex items-center justify-between mb-1';

    const countEl = document.createElement('span');
    countEl.className = 'text-xs text-gray-400';
    countEl.textContent = `${items.length} item${items.length !== 1 ? 's' : ''}`;

    const summaryRight = document.createElement('div');
    summaryRight.className = 'flex items-center gap-3';

    if (store) {
      const storeEl = document.createElement('span');
      storeEl.className = 'text-xs text-gray-400 italic';
      storeEl.textContent = store.name.replace(/^(Kroger|Harris Teeter)\s*-\s*/i, '');
      summaryRight.appendChild(storeEl);
    }

    const clearBtn = document.createElement('button');
    clearBtn.type = 'button';
    clearBtn.textContent = 'Clear checks';
    clearBtn.className = 'text-xs text-gray-400 hover:text-gray-600';
    clearBtn.onclick = () => { checked.clear(); checkedStaples.clear(); persistChecked(); render(); };

    summaryRight.appendChild(clearBtn);
    summaryRow.appendChild(countEl);
    summaryRow.appendChild(summaryRight);
    container.appendChild(summaryRow);

    if (store) {
      const legend = document.createElement('p');
      legend.className = 'text-xs text-gray-400 mb-4';
      legend.innerHTML = 'Sorted by aisle &middot; lowest available price &middot; <span class="text-green-600">green</span> = on sale';
      container.appendChild(legend);
    }

    // Determine if we have aisle data for all items (including staples)
    const allAislesCached = store && [...items, ...staples].every(
      item => aisleCache.has(`${store.locationId}:${item.name.toLowerCase()}`)
    );

    if (store && allAislesCached) {
      // ── Aisle-grouped render ────────────────────────────
      const config = getAisleConfig(store.locationId);

      // First pass: natural grouping by Kroger aisle data (recipe items + staples)
      const aisleMap = new Map();
      const allAisleItems = [
        ...items,
        ...staples.map(s => ({
          name: s.name, unit: s.unit || '', preparation: '', section: '',
          totalQty: parseQty(s.quantity), rawQty: s.quantity || '', isStaple: true,
        })),
      ];
      for (const item of allAisleItems) {
        const cacheKey = `${store.locationId}:${item.name.toLowerCase()}`;
        const aisle    = aisleCache.get(cacheKey);
        const groupKey = aisle?.number ?? '?';
        if (!aisleMap.has(groupKey)) aisleMap.set(groupKey, { aisle, items: [] });
        aisleMap.get(groupKey).items.push(item);
      }

      // Second pass: apply per-item overrides
      for (const [itemName, targetKey] of Object.entries(config.overrides)) {
        for (const [, group] of aisleMap) {
          const idx = group.items.findIndex(i => i.name.toLowerCase() === itemName);
          if (idx === -1) continue;
          const [item] = group.items.splice(idx, 1);
          if (!aisleMap.has(targetKey)) {
            aisleMap.set(targetKey, { aisle: { number: targetKey, description: '' }, items: [] });
          }
          aisleMap.get(targetKey).items.push(item);
          break;
        }
      }

      // Remove any groups emptied by overrides
      for (const [key, group] of aisleMap) {
        if (group.items.length === 0) aisleMap.delete(key);
      }

      const { order: savedOrder } = config;
      const sortedGroups = [...aisleMap.entries()].sort(([a], [b]) => {
        const ai = savedOrder.indexOf(a);
        const bi = savedOrder.indexOf(b);
        if (ai !== -1 && bi !== -1) return ai - bi;
        if (ai !== -1) return -1;
        if (bi !== -1) return 1;
        if (a === '?') return 1;
        if (b === '?') return -1;
        return parseInt(a) - parseInt(b);
      });

      // Reorder button — shows in header area
      const reorderBtn = document.createElement('button');
      reorderBtn.type = 'button';
      reorderBtn.textContent = 'Reorder aisles';
      reorderBtn.className = 'text-xs text-gray-400 hover:text-green-600';
      reorderBtn.onclick = () => showAisleReorderSheet(store, sortedGroups, render);
      summaryRight.prepend(reorderBtn);

      for (const [groupKey, { aisle, items: groupItems }] of sortedGroups) {
        const groupEl = document.createElement('div');
        groupEl.className = 'mb-5';

        const groupLabel = document.createElement('div');
        groupLabel.className = 'text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2';
        groupLabel.textContent = aisle?.number
          ? `Aisle ${aisle.number}${aisle.description ? ` · ${aisle.description}` : ''}`
          : 'Other';
        groupEl.appendChild(groupLabel);

        const card = document.createElement('div');
        card.className = 'card divide-y divide-gray-50';

        for (const item of groupItems) {
          card.appendChild(makeItemRow(item, store, checked,
            (movedItem) => showAisleAssignSheet(movedItem, store, sortedGroups, groupKey, render),
            persistChecked
          ));
        }

        groupEl.appendChild(card);
        container.appendChild(groupEl);
      }

    } else {
      // ── Section-grouped render (no store, or aisles still loading) ─
      // Groups by ingredient section; re-renders as aisle view once Kroger data loads.
      const sectionMap = new Map();
      for (const item of items) {
        const key = item.section || '';
        if (!sectionMap.has(key)) sectionMap.set(key, []);
        sectionMap.get(key).push(item);
      }

      const hasSections = sectionMap.size > 1 || (sectionMap.size === 1 && !sectionMap.has(''));
      if (hasSections) {
        const sortedSections = [...sectionMap.entries()].sort(([a], [b]) => {
          if (a === '') return 1;
          if (b === '') return -1;
          return a.localeCompare(b);
        });

        for (const [section, groupItems] of sortedSections) {
          const groupEl = document.createElement('div');
          groupEl.className = 'mb-5';

          const groupLabel = document.createElement('div');
          groupLabel.className = 'text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2';
          groupLabel.textContent = section || 'Other';
          groupEl.appendChild(groupLabel);

          const card = document.createElement('div');
          card.className = 'card divide-y divide-gray-50';
          for (const item of groupItems) {
            card.appendChild(makeItemRow(item, store, checked, null, persistChecked));
          }
          groupEl.appendChild(card);
          container.appendChild(groupEl);
        }
      } else {
        const card = document.createElement('div');
        card.className = 'card divide-y divide-gray-50 mb-5';
        for (const item of items) {
          card.appendChild(makeItemRow(item, store, checked, null, persistChecked));
        }
        container.appendChild(card);
      }

      if (store) {
        const allItems = [
          ...items,
          ...staples.map(s => ({ name: s.name, unit: s.unit || '' })),
        ];
        const uncached = allItems.filter(
          item => !aisleCache.has(`${store.locationId}:${item.name.toLowerCase()}`)
        );
        if (uncached.length > 0) {
          const gen = ++fetchGeneration;
          loadKrogerData(uncached, store.locationId, gen, async () => {
            if (fetchGeneration !== gen) return;
            await updateRecipeCosts(keys, store.locationId);
            render();
          });
        }
      }
    }

    renderStaplesSection(container, store, checkedStaples, allAislesCached, persistChecked);
  }

  render();
}

// ── Item row builder ───────────────────────────────────────

function makeItemRow(item, store, checked, onMove = null, onCheck = null) {
  const key       = `${item.name.toLowerCase()}|${(item.unit || '').toLowerCase()}`;
  const isChecked = checked.has(key);

  const row = document.createElement('label');
  row.className = `flex items-center gap-3 py-2.5 px-1 cursor-pointer${isChecked ? ' opacity-40' : ''}`;

  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.checked = isChecked;
  checkbox.className = 'w-4 h-4 rounded accent-green-600 shrink-0';
  checkbox.onchange = () => {
    if (checkbox.checked) checked.add(key); else checked.delete(key);
    row.className = `flex items-center gap-3 py-2.5 px-1 cursor-pointer${checkbox.checked ? ' opacity-40' : ''}`;
    textEl.classList.toggle('line-through', checkbox.checked);
    if (onCheck) onCheck();
  };

  const textEl = document.createElement('span');
  textEl.className = `text-sm text-gray-800 flex-1${isChecked ? ' line-through' : ''}`;

  const qtyStr = item.totalQty > 0 ? formatQty(item.totalQty) : item.rawQty;
  const parts  = [qtyStr, item.unit, item.name].filter(Boolean).join(' ');
  textEl.textContent = item.preparation ? `${parts}, ${item.preparation}` : parts;

  row.appendChild(checkbox);
  row.appendChild(textEl);

  if (store) {
    const cacheKey = `${store.locationId}:${item.name.toLowerCase()}`;
    const priceEl  = document.createElement('span');
    priceEl.className = 'text-xs text-gray-400 shrink-0 w-12 text-right tabular-nums';

    const cached = priceCache.get(cacheKey);
    if (cached) {
      priceEl.textContent = cached.text;
      if (cached.promo) priceEl.classList.replace('text-gray-400', 'text-green-600');
    } else {
      priceEl.textContent = '···';
    }

    row.appendChild(priceEl);
  }

  if (onMove) {
    const moveBtn = document.createElement('button');
    moveBtn.type = 'button';
    moveBtn.textContent = '↔';
    moveBtn.title = 'Move to different aisle';
    moveBtn.className = 'text-gray-300 hover:text-green-500 text-sm leading-none shrink-0 pl-1';
    moveBtn.onclick = e => { e.preventDefault(); onMove(item); };
    row.appendChild(moveBtn);
  }

  return row;
}
