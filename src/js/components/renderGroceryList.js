import { recipes, mealPlans, saveMealPlans } from '../data/index.js';
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

// ── Section display order ──────────────────────────────────

const SECTION_ORDER = [
  'Produce', 'Meat/Seafood', 'Dairy', 'Bakery',
  'Canned Goods', 'Dry Goods', 'Baking Goods',
  'Frozen', 'Spices/Condiments', 'Beverages', 'Other',
];

function sectionSortKey(s) {
  const i = SECTION_ORDER.indexOf(s);
  return i === -1 ? SECTION_ORDER.length : i;
}

// ── Aggregation ────────────────────────────────────────────

function buildGroceryList(dateKeys, defaultServings) {
  const rangeEntries = mealPlans.filter(e => dateKeys.includes(e.date));

  // key: "name|unit" → aggregated item
  const map = new Map();

  for (const entry of rangeEntries) {
    const recipe = recipes.find(r => r.id === entry.recipeId);
    if (!recipe) continue;

    const desired = entry.servings ?? defaultServings;
    const scale   = desired / (recipe.servings || 1);

    for (const ing of (recipe.ingredients || [])) {
      if (!ing.quantity && !ing.unit) continue; // skip group header rows

      const key = `${ing.name.toLowerCase().trim()}|${(ing.unit || '').toLowerCase().trim()}`;
      const scaledQty = parseQty(ing.quantity) * scale;

      if (map.has(key)) {
        map.get(key).totalQty += scaledQty;
      } else {
        map.set(key, {
          name:        ing.name,
          unit:        ing.unit || '',
          section:     ing.section || 'Other',
          preparation: ing.preparation || '',
          totalQty:    scaledQty,
          rawQty:      ing.quantity || '',
        });
      }
    }
  }

  const sections = new Map();
  for (const item of map.values()) {
    const sec = item.section || 'Other';
    if (!sections.has(sec)) sections.set(sec, []);
    sections.get(sec).push(item);
  }

  return [...sections.entries()]
    .sort(([a], [b]) => sectionSortKey(a) - sectionSortKey(b) || a.localeCompare(b))
    .map(([section, items]) => ({
      section,
      items: items.sort((a, b) => a.name.localeCompare(b.name)),
    }));
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

// ── Main render ────────────────────────────────────────────

export function renderGroceryList() {
  const container = document.getElementById('app-content');
  container.innerHTML = '';

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let startDate      = today;
  let endDate        = addDays(today, 6);
  let defaultServings = parseInt(localStorage.getItem('groceryDefaultServings')) || 4;

  const checked = new Set();

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
        checked.clear();
        render();
      },
    });

    headerRow.appendChild(rangePill);
    headerRow.appendChild(settingsBtn);
    container.appendChild(headerRow);

    const keys = [];
    const d = new Date(startDate);
    while (d <= endDate) { keys.push(toDateKey(d)); d.setDate(d.getDate() + 1); }

    const sections = buildGroceryList(keys, defaultServings);

    if (sections.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'text-gray-400 text-sm text-center py-16';
      empty.textContent = 'No meals planned in this date range.';
      container.appendChild(empty);
      return;
    }

    const totalItems = sections.reduce((n, s) => n + s.items.length, 0);
    const summaryRow = document.createElement('div');
    summaryRow.className = 'flex items-center justify-between mb-4';

    const countEl = document.createElement('span');
    countEl.className = 'text-xs text-gray-400';
    countEl.textContent = `${totalItems} item${totalItems !== 1 ? 's' : ''}`;

    const clearBtn = document.createElement('button');
    clearBtn.type = 'button';
    clearBtn.textContent = 'Clear checks';
    clearBtn.className = 'text-xs text-gray-400 hover:text-gray-600';
    clearBtn.onclick = () => { checked.clear(); render(); };

    summaryRow.appendChild(countEl);
    summaryRow.appendChild(clearBtn);
    container.appendChild(summaryRow);

    for (const { section, items } of sections) {
      const sectionEl = document.createElement('div');
      sectionEl.className = 'mb-5';

      const sectionLabel = document.createElement('div');
      sectionLabel.className = 'text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2';
      sectionLabel.textContent = section;
      sectionEl.appendChild(sectionLabel);

      const card = document.createElement('div');
      card.className = 'card divide-y divide-gray-50';

      for (const item of items) {
        const key = `${item.name.toLowerCase()}|${item.unit.toLowerCase()}`;
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
        };

        const textEl = document.createElement('span');
        textEl.className = `text-sm text-gray-800 flex-1${isChecked ? ' line-through' : ''}`;

        const qtyStr = item.totalQty > 0 ? formatQty(item.totalQty) : item.rawQty;
        const parts  = [qtyStr, item.unit, item.name].filter(Boolean).join(' ');
        textEl.textContent = item.preparation ? `${parts}, ${item.preparation}` : parts;

        row.appendChild(checkbox);
        row.appendChild(textEl);
        card.appendChild(row);
      }

      sectionEl.appendChild(card);
      container.appendChild(sectionEl);
    }
  }

  render();
}
