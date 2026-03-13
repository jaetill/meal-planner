import { recipes } from '../data/index.js';
import { mealPlans, saveMealPlans } from '../data/index.js';
import { btn } from '../ui/elements.js';
import { toastError } from '../ui/toast.js';
import { renderRecipeView } from './renderRecipeView.js';

const MEALS = ['Breakfast', 'Lunch', 'Dinner'];

// ── Date helpers ──────────────────────────────────────────

function getMondayOf(date) {
  const d = new Date(date);
  const day = d.getDay(); // 0=Sun
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function toDateKey(date) {
  return date.toISOString().slice(0, 10); // "YYYY-MM-DD"
}

function formatDayHeading(date) {
  return date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
}

// ── Main render ───────────────────────────────────────────

export function renderMealPlan() {
  const container = document.getElementById('app-content');
  container.innerHTML = '';

  let weekStart = getMondayOf(new Date());

  function render() {
    container.innerHTML = '';

    // Week nav header
    const nav = document.createElement('div');
    nav.className = 'flex items-center justify-between mb-4';

    const prevBtn = btn('←', 'ghost');
    prevBtn.onclick = () => { weekStart = addDays(weekStart, -7); render(); };

    const nextBtn = btn('→', 'ghost');
    nextBtn.onclick = () => { weekStart = addDays(weekStart, 7); render(); };

    const weekLabel = document.createElement('span');
    weekLabel.className = 'text-sm font-semibold text-gray-700';
    const weekEnd = addDays(weekStart, 6);
    weekLabel.textContent = `${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;

    nav.appendChild(prevBtn);
    nav.appendChild(weekLabel);
    nav.appendChild(nextBtn);
    container.appendChild(nav);

    // Days
    for (let i = 0; i < 7; i++) {
      const day = addDays(weekStart, i);
      const dateKey = toDateKey(day);
      const dayEntries = mealPlans.filter(e => e.date === dateKey);

      const card = document.createElement('div');
      card.className = 'card mb-3';

      // Day heading
      const heading = document.createElement('div');
      heading.className = 'flex items-center justify-between mb-2';

      const dayLabel = document.createElement('span');
      dayLabel.className = 'text-sm font-bold text-gray-800';
      dayLabel.textContent = formatDayHeading(day);

      const addBtn = btn('+ Add', 'ghost');
      addBtn.className += ' text-xs text-green-600';
      addBtn.onclick = () => showPicker(dateKey, render);

      heading.appendChild(dayLabel);
      heading.appendChild(addBtn);
      card.appendChild(heading);

      if (dayEntries.length === 0) {
        const empty = document.createElement('p');
        empty.className = 'text-xs text-gray-300 italic';
        empty.textContent = 'Nothing planned';
        card.appendChild(empty);
      } else {
        // Group by meal
        const byMeal = {};
        dayEntries.forEach(e => {
          if (!byMeal[e.meal]) byMeal[e.meal] = [];
          byMeal[e.meal].push(e);
        });

        MEALS.forEach(meal => {
          if (!byMeal[meal]) return;
          const mealGroup = document.createElement('div');
          mealGroup.className = 'mb-2';

          const mealLabel = document.createElement('span');
          mealLabel.className = 'text-xs font-semibold text-gray-400 uppercase tracking-wide';
          mealLabel.textContent = meal;
          mealGroup.appendChild(mealLabel);

          byMeal[meal].forEach(entry => {
            const recipe = recipes.find(r => r.id === entry.recipeId);
            const row = document.createElement('div');
            row.className = 'flex items-center justify-between gap-2 py-0.5';

            const nameEl = document.createElement('span');
            nameEl.className = 'text-sm text-gray-800 flex-1 cursor-pointer hover:text-green-700';
            nameEl.textContent = recipe ? recipe.name : '(deleted recipe)';
            if (recipe) {
              nameEl.onclick = () => renderRecipeView(recipe, renderMealPlan);
            }

            const removeBtn = document.createElement('button');
            removeBtn.type = 'button';
            removeBtn.textContent = '×';
            removeBtn.className = 'text-gray-300 hover:text-red-400 text-lg leading-none shrink-0';
            removeBtn.onclick = async () => {
              const updated = mealPlans.filter(e => e.id !== entry.id);
              try {
                await saveMealPlans(updated);
                render();
              } catch {
                toastError('Could not remove. Try again.');
              }
            };

            row.appendChild(nameEl);
            row.appendChild(removeBtn);
            mealGroup.appendChild(row);
          });

          card.appendChild(mealGroup);
        });
      }

      container.appendChild(card);
    }
  }

  render();
}

// ── Recipe picker modal ───────────────────────────────────

function showPicker(dateKey, onSave) {
  const overlay = document.createElement('div');
  overlay.className = 'fixed inset-0 bg-black/40 z-40 flex items-end justify-center pb-16';

  const sheet = document.createElement('div');
  sheet.className = 'bg-white w-full max-w-2xl rounded-t-2xl p-4 max-h-[80vh] flex flex-col';

  // Header
  const header = document.createElement('div');
  header.className = 'flex items-center justify-between mb-3';

  const title = document.createElement('span');
  title.className = 'font-bold text-gray-800';
  title.textContent = 'Add to meal plan';

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.textContent = '×';
  closeBtn.className = 'text-gray-400 text-2xl leading-none';
  closeBtn.onclick = () => overlay.remove();

  header.appendChild(title);
  header.appendChild(closeBtn);
  sheet.appendChild(header);

  // Meal selector
  const mealRow = document.createElement('div');
  mealRow.className = 'flex gap-2 mb-3';
  let selectedMeal = 'Dinner';

  const mealBtns = MEALS.map(meal => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = meal;
    b.className = meal === selectedMeal
      ? 'text-xs px-3 py-1 rounded-full bg-green-600 text-white font-medium'
      : 'text-xs px-3 py-1 rounded-full bg-gray-100 text-gray-600';
    b.onclick = () => {
      selectedMeal = meal;
      mealBtns.forEach((mb, mi) => {
        mb.className = MEALS[mi] === selectedMeal
          ? 'text-xs px-3 py-1 rounded-full bg-green-600 text-white font-medium'
          : 'text-xs px-3 py-1 rounded-full bg-gray-100 text-gray-600';
      });
    };
    mealRow.appendChild(b);
    return b;
  });
  sheet.appendChild(mealRow);

  // Search
  const searchInput = document.createElement('input');
  searchInput.type = 'text';
  searchInput.placeholder = 'Search recipes…';
  searchInput.className = 'field mb-3';
  sheet.appendChild(searchInput);

  // Recipe list
  const listEl = document.createElement('div');
  listEl.className = 'overflow-y-auto flex-1 space-y-1';
  sheet.appendChild(listEl);

  function renderList(query = '') {
    listEl.innerHTML = '';
    const filtered = query
      ? recipes.filter(r => r.name.toLowerCase().includes(query.toLowerCase()))
      : [...recipes].sort((a, b) => a.name.localeCompare(b.name));

    filtered.forEach(recipe => {
      const row = document.createElement('button');
      row.type = 'button';
      row.className = 'w-full text-left px-3 py-2 rounded-lg hover:bg-green-50 text-sm text-gray-800';
      row.textContent = recipe.name;
      row.onclick = async () => {
        const entry = {
          id: crypto.randomUUID(),
          date: dateKey,
          meal: selectedMeal,
          recipeId: recipe.id,
        };
        try {
          await saveMealPlans([...mealPlans, entry]);
          overlay.remove();
          onSave();
        } catch {
          toastError('Could not add. Try again.');
        }
      };
      listEl.appendChild(row);
    });

    if (filtered.length === 0) {
      const none = document.createElement('p');
      none.className = 'text-gray-400 text-sm text-center py-4';
      none.textContent = 'No recipes match.';
      listEl.appendChild(none);
    }
  }

  searchInput.oninput = () => renderList(searchInput.value.trim());
  renderList();

  overlay.appendChild(sheet);
  overlay.onclick = e => { if (e.target === overlay) overlay.remove(); };
  document.body.appendChild(overlay);
  searchInput.focus();
}
