import { recipes } from '../data/index.js';
import { mealPlans, saveMealPlans, generateMealPlan, refineMealPlan } from '../data/index.js';
import { calcNutritionByMeal, populateRecipeNutrition } from '../data/nutrition.js';
import { btn } from '../ui/elements.js';
import { toastError, toastSuccess } from '../ui/toast.js';
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

    const aiBtn = btn('AI Plan', 'ghost');
    aiBtn.className = 'text-xs px-3 py-1 rounded-full bg-purple-50 text-purple-600 font-medium hover:bg-purple-100';
    aiBtn.onclick = () => showAIPlanModal(weekStart, render);

    nav.appendChild(prevBtn);
    nav.appendChild(weekLabel);
    nav.appendChild(aiBtn);
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
            const isPlain = !!entry.plainText;
            const recipe = isPlain ? null : recipes.find(r => r.id === entry.recipeId);
            const row = document.createElement('div');
            row.className = 'flex items-center gap-2 py-0.5';

            const nameEl = document.createElement('span');
            nameEl.className = 'text-sm text-gray-800 flex-1' + (isPlain ? '' : ' cursor-pointer hover:text-green-700');
            nameEl.textContent = isPlain ? entry.plainText : (recipe ? recipe.name : '(deleted recipe)');
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

            // Plain items don't get servings/cost controls
            if (!isPlain) {
              // Servings badge — tap to edit inline
              const defaultServings = parseInt(localStorage.getItem('groceryDefaultServings')) || 4;
              let currentServings = entry.servings ?? defaultServings;

              const servingsWrap = document.createElement('div');
              servingsWrap.className = 'flex items-center shrink-0';

              function showBadge() {
                servingsWrap.innerHTML = '';
                const badge = document.createElement('button');
                badge.type = 'button';
                badge.className = 'text-xs text-gray-400 hover:text-green-600 px-1.5 py-0.5 rounded hover:bg-green-50';
                badge.textContent = `${currentServings}×`;
                badge.title = 'Edit servings';
                badge.onclick = showStepper;
                servingsWrap.appendChild(badge);
              }

              function showStepper() {
                servingsWrap.innerHTML = '';

                const minus = document.createElement('button');
                minus.type = 'button';
                minus.textContent = '−';
                minus.className = 'text-xs w-5 h-5 flex items-center justify-center text-gray-400 hover:text-gray-700';

                const display = document.createElement('span');
                display.className = 'text-xs font-semibold text-gray-700 w-5 text-center';
                display.textContent = currentServings;

                const plus = document.createElement('button');
                plus.type = 'button';
                plus.textContent = '+';
                plus.className = 'text-xs w-5 h-5 flex items-center justify-center text-gray-400 hover:text-gray-700';

                const confirm = document.createElement('button');
                confirm.type = 'button';
                confirm.textContent = '✓';
                confirm.className = 'text-xs w-5 h-5 flex items-center justify-center text-green-600 hover:text-green-700 ml-0.5';

                minus.onclick = () => {
                  if (currentServings > 1) { currentServings--; display.textContent = currentServings; }
                };
                plus.onclick = () => {
                  currentServings++;
                  display.textContent = currentServings;
                };
                confirm.onclick = async () => {
                  entry.servings = currentServings;
                  try {
                    await saveMealPlans([...mealPlans]);
                  } catch {
                    toastError('Could not save servings. Try again.');
                  }
                  showBadge();
                };

                servingsWrap.appendChild(minus);
                servingsWrap.appendChild(display);
                servingsWrap.appendChild(plus);
                servingsWrap.appendChild(confirm);
              }

              showBadge();

              if (recipe?.estimatedCostPerServing != null) {
                const costEl = document.createElement('span');
                costEl.className = 'text-xs text-gray-400 shrink-0 tabular-nums';
                costEl.title = `Estimated cost per serving · based on ${recipe.costSampleCount} price ${recipe.costSampleCount === 1 ? 'snapshot' : 'snapshots'}`;
                costEl.textContent = `≈$${recipe.estimatedCostPerServing.toFixed(2)}`;
                row.appendChild(costEl);
              }

              row.appendChild(servingsWrap);
            }

            row.appendChild(removeBtn);
            mealGroup.appendChild(row);
          });

          card.appendChild(mealGroup);
        });
      }

      // Daily nutrition summary — per meal
      if (dayEntries.length > 0) {
        const byMeal = calcNutritionByMeal(dayEntries, recipes);
        if (byMeal) {
          const nutritionSection = document.createElement('div');
          nutritionSection.className = 'mt-2 pt-2 border-t border-gray-50 space-y-0.5';

          const MEAL_ABBREV = { Breakfast: 'B', Lunch: 'L', Dinner: 'D' };
          const mealCount = Object.keys(byMeal).length;

          MEALS.forEach(meal => {
            const n = byMeal[meal];
            if (!n) return;

            const row = document.createElement('div');
            row.className = 'flex gap-3 items-center';

            if (mealCount > 1) {
              const mealLabel = document.createElement('span');
              mealLabel.className = 'text-xs text-gray-300 w-3 shrink-0';
              mealLabel.textContent = MEAL_ABBREV[meal] || meal[0];
              row.appendChild(mealLabel);
            }

            [
              { label: 'cal',  value: n.calories },
              { label: 'pro',  value: n.protein,  unit: 'g' },
              { label: 'fat',  value: n.fat,       unit: 'g' },
              { label: 'carb', value: n.carbs,     unit: 'g' },
            ].forEach(({ label, value, unit = '' }) => {
              const item = document.createElement('span');
              item.className = 'text-xs text-gray-400';
              item.textContent = `${value}${unit} ${label}`;
              row.appendChild(item);
            });

            nutritionSection.appendChild(row);
          });

          card.appendChild(nutritionSection);
        }
      }

      container.appendChild(card);
    }
  }

  render();
  prefetchWeekNutrition();

  function prefetchWeekNutrition() {
    const keys = Array.from({ length: 7 }, (_, i) =>
      toDateKey(addDays(weekStart, i))
    );
    const unpopulated = [...new Set(
      mealPlans
        .filter(e => keys.includes(e.date) && e.recipeId)
        .map(e => e.recipeId)
    )]
      .map(id => recipes.find(r => r.id === id))
      .filter(r => r && r.ingredients?.some(ing => ing.quantity && ing.calories == null));

    if (unpopulated.length === 0) return;

    (async () => {
      for (const recipe of unpopulated) {
        await populateRecipeNutrition(recipe);
      }
      render();
    })();
  }
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
  searchInput.placeholder = 'Search recipes or type a quick item…';
  searchInput.className = 'field mb-3';
  sheet.appendChild(searchInput);

  // Recipe list
  const listEl = document.createElement('div');
  listEl.className = 'overflow-y-auto flex-1 space-y-1';
  sheet.appendChild(listEl);

  async function addPlainItem(text) {
    const entry = {
      id: crypto.randomUUID(),
      date: dateKey,
      meal: selectedMeal,
      plainText: text.trim(),
    };
    try {
      await saveMealPlans([...mealPlans, entry]);
      overlay.remove();
      onSave();
    } catch {
      toastError('Could not add. Try again.');
    }
  }

  function renderList(query = '') {
    listEl.innerHTML = '';
    const filtered = query
      ? recipes.filter(r => r.name.toLowerCase().includes(query.toLowerCase()))
      : [...recipes].sort((a, b) => a.name.localeCompare(b.name));

    // Quick-add option when there's text typed
    if (query) {
      const quickRow = document.createElement('button');
      quickRow.type = 'button';
      quickRow.className = 'w-full text-left px-3 py-2 rounded-lg hover:bg-blue-50 text-sm text-blue-700 border border-dashed border-blue-200 mb-1';
      quickRow.textContent = `+ Add "${query}" as quick item`;
      quickRow.onclick = () => addPlainItem(query);
      listEl.appendChild(quickRow);
    }

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

    if (filtered.length === 0 && !query) {
      const none = document.createElement('p');
      none.className = 'text-gray-400 text-sm text-center py-4';
      none.textContent = 'No recipes yet.';
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

// ── AI Plan preferences modal ────────────────────────────────

function showAIPlanModal(weekStart, onPlanAccepted) {
  const overlay = document.createElement('div');
  overlay.className = 'fixed inset-0 bg-black/40 z-40 flex items-end justify-center pb-16';

  const sheet = document.createElement('div');
  sheet.className = 'bg-white w-full max-w-2xl rounded-t-2xl p-4 max-h-[80vh] flex flex-col overflow-y-auto';

  // Header
  const header = document.createElement('div');
  header.className = 'flex items-center justify-between mb-4';

  const title = document.createElement('span');
  title.className = 'font-bold text-gray-800';
  title.textContent = 'AI Meal Plan';

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.textContent = '×';
  closeBtn.className = 'text-gray-400 text-2xl leading-none';
  closeBtn.onclick = () => overlay.remove();

  header.appendChild(title);
  header.appendChild(closeBtn);
  sheet.appendChild(header);

  // Plan dates (start / end)
  const dateLabel = document.createElement('span');
  dateLabel.className = 'block text-sm font-medium text-gray-700 mb-1';
  dateLabel.textContent = 'Plan dates';
  sheet.appendChild(dateLabel);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const dateRow = document.createElement('div');
  dateRow.className = 'flex items-center gap-2 mb-4';

  const startInput = document.createElement('input');
  startInput.type = 'date';
  startInput.value = toDateKey(today);
  startInput.className = 'field';

  const dateSep = document.createElement('span');
  dateSep.className = 'text-gray-400 text-sm';
  dateSep.textContent = '—';

  const endInput = document.createElement('input');
  endInput.type = 'date';
  endInput.value = toDateKey(addDays(today, 6));
  endInput.className = 'field';

  dateRow.appendChild(startInput);
  dateRow.appendChild(dateSep);
  dateRow.appendChild(endInput);
  sheet.appendChild(dateRow);

  // Target calories
  const calLabel = document.createElement('label');
  calLabel.className = 'block text-sm font-medium text-gray-700 mb-1';
  calLabel.textContent = 'Daily calorie target (optional)';
  sheet.appendChild(calLabel);

  const calInput = document.createElement('input');
  calInput.type = 'number';
  calInput.placeholder = '2000';
  calInput.value = localStorage.getItem('aiPlanCalories') || '';
  calInput.className = 'field w-full mb-4';
  sheet.appendChild(calInput);

  // Meals to fill
  const mealsLabel = document.createElement('span');
  mealsLabel.className = 'block text-sm font-medium text-gray-700 mb-2';
  mealsLabel.textContent = 'Meals to plan';
  sheet.appendChild(mealsLabel);

  const selectedMeals = new Set(['Breakfast', 'Lunch', 'Dinner']);
  const mealsRow = document.createElement('div');
  mealsRow.className = 'flex gap-2 mb-4';

  MEALS.forEach(meal => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.textContent = meal;
    const setStyle = (on) => {
      chip.className = on
        ? 'text-xs px-3 py-1 rounded-full bg-green-600 text-white font-medium'
        : 'text-xs px-3 py-1 rounded-full bg-gray-100 text-gray-600';
    };
    setStyle(true);
    chip.onclick = () => {
      if (selectedMeals.has(meal)) { selectedMeals.delete(meal); setStyle(false); }
      else { selectedMeals.add(meal); setStyle(true); }
    };
    mealsRow.appendChild(chip);
  });
  sheet.appendChild(mealsRow);

  // Day constraints
  const dayLabel = document.createElement('span');
  dayLabel.className = 'block text-sm font-medium text-gray-700 mb-2';
  dayLabel.textContent = 'Day time constraints';
  sheet.appendChild(dayLabel);

  const CONSTRAINT_OPTIONS = ['normal', 'quick', 'elaborate', 'none'];
  const CONSTRAINT_STYLES = {
    normal:    'bg-gray-100 text-gray-600',
    quick:     'bg-amber-100 text-amber-700',
    elaborate: 'bg-blue-100 text-blue-700',
    none:      'bg-red-100 text-red-600',
  };
  const dayConstraints = {};

  const daysGrid = document.createElement('div');
  daysGrid.className = 'space-y-1 mb-4';

  function rebuildDaysGrid() {
    daysGrid.innerHTML = '';
    // Clear old constraints
    for (const k of Object.keys(dayConstraints)) delete dayConstraints[k];

    const start = new Date(startInput.value + 'T00:00:00');
    const end = new Date(endInput.value + 'T00:00:00');
    const dayCount = Math.round((end - start) / 86400000) + 1;
    if (dayCount < 1 || dayCount > 14) return;

    for (let i = 0; i < dayCount; i++) {
      const day = addDays(start, i);
      const dateKey = toDateKey(day);
      dayConstraints[dateKey] = 'normal';

      const row = document.createElement('div');
      row.className = 'flex items-center gap-2';

      const dayName = document.createElement('span');
      dayName.className = 'text-xs text-gray-600 w-20 shrink-0';
      dayName.textContent = day.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
      row.appendChild(dayName);

      const chipGroup = document.createElement('div');
      chipGroup.className = 'flex gap-1';

      const chips = CONSTRAINT_OPTIONS.map(opt => {
        const c = document.createElement('button');
        c.type = 'button';
        c.textContent = opt;
        c.className = `text-xs px-2 py-0.5 rounded-full ${opt === 'normal' ? CONSTRAINT_STYLES[opt] + ' ring-1 ring-gray-300' : CONSTRAINT_STYLES[opt]}`;
        c.onclick = () => {
          dayConstraints[dateKey] = opt;
          chips.forEach(ch => {
            const o = ch.textContent;
            ch.className = `text-xs px-2 py-0.5 rounded-full ${CONSTRAINT_STYLES[o]}${o === opt ? ' ring-1 ring-gray-300' : ''}`;
          });
        };
        chipGroup.appendChild(c);
        return c;
      });

      row.appendChild(chipGroup);
      daysGrid.appendChild(row);
    }
  }

  startInput.onchange = rebuildDaysGrid;
  endInput.onchange = rebuildDaysGrid;
  rebuildDaysGrid();

  sheet.appendChild(daysGrid);

  // Notes
  const notesLabel = document.createElement('label');
  notesLabel.className = 'block text-sm font-medium text-gray-700 mb-1';
  notesLabel.textContent = 'Notes (optional)';
  sheet.appendChild(notesLabel);

  const notesInput = document.createElement('textarea');
  notesInput.placeholder = 'e.g. "less chicken this week", "want to try something new"';
  notesInput.className = 'field w-full mb-4 resize-none';
  notesInput.rows = 2;
  sheet.appendChild(notesInput);

  // Generate button
  const genBtn = btn('Generate Plan', 'primary');
  genBtn.className += ' w-full';
  genBtn.onclick = async () => {
    // Validate date range
    const planDates = Object.keys(dayConstraints).sort();
    if (planDates.length === 0) {
      toastError('Select at least one day to plan.');
      return;
    }
    if (planDates.length > 14) {
      toastError('Date range cannot exceed 14 days.');
      return;
    }

    const targetCalories = parseInt(calInput.value) || null;
    if (targetCalories) localStorage.setItem('aiPlanCalories', targetCalories);

    // Filter out "normal" constraints — only send non-default
    const constraints = {};
    for (const [k, v] of Object.entries(dayConstraints)) {
      if (v !== 'normal') constraints[k] = v;
    }

    // Gather existing entries for the selected dates
    const dateSet = new Set(planDates);
    const existingEntries = mealPlans.filter(e => dateSet.has(e.date));

    // Gather 2 weeks of history before the start date
    const rangeStart = new Date(planDates[0] + 'T00:00:00');
    const histStart = addDays(rangeStart, -14);
    const histDates = Array.from({ length: 14 }, (_, i) => toDateKey(addDays(histStart, i)));
    const history = mealPlans.filter(e => histDates.includes(e.date));

    genBtn.disabled = true;
    genBtn.textContent = 'Generating…';

    try {
      const result = await generateMealPlan({
        dates: planDates,
        preferences: {
          targetCalories,
          dietaryNotes: notesInput.value.trim() || undefined,
          mealsToFill: [...selectedMeals],
          dayConstraints: Object.keys(constraints).length > 0 ? constraints : undefined,
        },
        existingEntries,
        history,
      });

      overlay.remove();
      showAIPlanReview(planDates, result, onPlanAccepted);
    } catch (err) {
      toastError(err.message || 'Could not generate plan. Try again.');
      genBtn.disabled = false;
      genBtn.textContent = 'Generate Plan';
    }
  };
  sheet.appendChild(genBtn);

  overlay.appendChild(sheet);
  overlay.onclick = e => { if (e.target === overlay) overlay.remove(); };
  document.body.appendChild(overlay);
}

// ── AI Plan review overlay ───────────────────────────────────

function showAIPlanReview(planDates, result, onAccepted) {
  const overlay = document.createElement('div');
  overlay.className = 'fixed inset-0 bg-black/40 z-40 flex items-center justify-center p-4';

  const panel = document.createElement('div');
  panel.className = 'bg-white w-full max-w-2xl rounded-2xl flex flex-col max-h-[90vh]';

  // Header
  const header = document.createElement('div');
  header.className = 'flex items-center justify-between p-4 border-b border-gray-100';

  const title = document.createElement('span');
  title.className = 'font-bold text-gray-800';
  title.textContent = 'Proposed Meal Plan';

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.textContent = '×';
  closeBtn.className = 'text-gray-400 text-2xl leading-none';
  closeBtn.onclick = () => overlay.remove();

  header.appendChild(title);
  header.appendChild(closeBtn);
  panel.appendChild(header);

  // Scrollable body
  const body = document.createElement('div');
  body.className = 'flex-1 overflow-y-auto p-4';

  let currentResult = result;

  function renderProposal() {
    body.innerHTML = '';

    // Nutrition summary
    if (currentResult.nutritionSummary) {
      const ns = currentResult.nutritionSummary;
      const sumBar = document.createElement('div');
      sumBar.className = 'flex gap-4 mb-4 p-2 bg-green-50 rounded-lg';

      const calEl = document.createElement('span');
      calEl.className = 'text-xs text-green-700';
      calEl.textContent = `Avg ${ns.avgDailyCalories} cal/day`;
      sumBar.appendChild(calEl);

      if (ns.avgDailyProtein) {
        const proEl = document.createElement('span');
        proEl.className = 'text-xs text-green-700';
        proEl.textContent = `${ns.avgDailyProtein}g protein/day`;
        sumBar.appendChild(proEl);
      }

      body.appendChild(sumBar);
    }

    // Day cards
    for (const dateKey of planDates) {
      const day = new Date(dateKey + 'T00:00:00');
      const dayPlan = (currentResult.plan || []).filter(e => e.date === dateKey);

      if (dayPlan.length === 0) continue;

      const card = document.createElement('div');
      card.className = 'mb-3 p-3 border border-purple-100 rounded-xl bg-purple-50/30';

      const heading = document.createElement('div');
      heading.className = 'text-sm font-bold text-gray-800 mb-1';
      heading.textContent = formatDayHeading(day);
      card.appendChild(heading);

      // Group by meal
      const byMeal = {};
      dayPlan.forEach(e => {
        if (!byMeal[e.meal]) byMeal[e.meal] = [];
        byMeal[e.meal].push(e);
      });

      MEALS.forEach(meal => {
        if (!byMeal[meal]) return;

        const mealLabel = document.createElement('span');
        mealLabel.className = 'text-xs font-semibold text-gray-400 uppercase tracking-wide';
        mealLabel.textContent = meal;
        card.appendChild(mealLabel);

        byMeal[meal].forEach(entry => {
          const isPlain = !!entry.plainText;
          const recipe = isPlain ? null : recipes.find(r => r.id === entry.recipeId);

          const row = document.createElement('div');
          row.className = 'flex items-start gap-2 py-1';

          const nameCol = document.createElement('div');
          nameCol.className = 'flex-1 min-w-0';

          const nameEl = document.createElement('span');
          nameEl.className = 'text-sm text-gray-800 block' + (recipe ? ' cursor-pointer hover:text-green-700' : '');
          nameEl.textContent = isPlain ? entry.plainText : (recipe ? recipe.name : '(unknown recipe)');
          if (recipe) {
            nameEl.onclick = () => {
              overlay.remove();
              renderRecipeView(recipe, () => {
                // Re-show review when coming back
                showAIPlanReview(planDates, currentResult, onAccepted);
              });
            };
          }
          nameCol.appendChild(nameEl);

          if (entry.reasoning) {
            const reasonEl = document.createElement('span');
            reasonEl.className = 'text-xs text-gray-400 italic block';
            reasonEl.textContent = entry.reasoning;
            nameCol.appendChild(reasonEl);
          }

          row.appendChild(nameCol);

          // Remove button
          const removeBtn = document.createElement('button');
          removeBtn.type = 'button';
          removeBtn.textContent = '×';
          removeBtn.className = 'text-gray-300 hover:text-red-400 text-lg leading-none shrink-0';
          removeBtn.onclick = () => {
            currentResult.plan = currentResult.plan.filter(e => e !== entry);
            renderProposal();
          };
          row.appendChild(removeBtn);

          card.appendChild(row);
        });
      });

      body.appendChild(card);
    }

    // Shopping notes
    if (currentResult.shoppingNotes) {
      const notesCard = document.createElement('div');
      notesCard.className = 'p-3 bg-amber-50 rounded-xl mb-3';

      const notesLabel = document.createElement('span');
      notesLabel.className = 'text-xs font-semibold text-amber-700 block mb-1';
      notesLabel.textContent = 'Shopping Notes';

      const notesText = document.createElement('p');
      notesText.className = 'text-xs text-amber-800';
      notesText.textContent = currentResult.shoppingNotes;

      notesCard.appendChild(notesLabel);
      notesCard.appendChild(notesText);
      body.appendChild(notesCard);
    }
  }

  renderProposal();
  panel.appendChild(body);

  // Footer
  const footer = document.createElement('div');
  footer.className = 'p-4 border-t border-gray-100 space-y-3';

  // Refine input
  const refineRow = document.createElement('div');
  refineRow.className = 'flex gap-2';

  const refineInput = document.createElement('input');
  refineInput.type = 'text';
  refineInput.placeholder = 'Refine: "swap Tuesday dinner for pasta"';
  refineInput.className = 'field flex-1';

  const refineBtn = btn('Refine', 'ghost');
  refineBtn.className += ' text-purple-600 shrink-0';
  refineBtn.onclick = async () => {
    const text = refineInput.value.trim();
    if (!text) return;

    refineBtn.disabled = true;
    refineBtn.textContent = 'Refining…';
    refineInput.disabled = true;

    try {
      const refined = await refineMealPlan({
        currentPlan: currentResult.plan,
        refinement: text,
      });
      currentResult = refined;
      refineInput.value = '';
      renderProposal();
    } catch (err) {
      toastError(err.message || 'Refinement failed. Try again.');
    } finally {
      refineBtn.disabled = false;
      refineBtn.textContent = 'Refine';
      refineInput.disabled = false;
    }
  };

  // Also allow Enter key to submit refinement
  refineInput.onkeydown = (e) => {
    if (e.key === 'Enter') refineBtn.onclick();
  };

  refineRow.appendChild(refineInput);
  refineRow.appendChild(refineBtn);
  footer.appendChild(refineRow);

  // Accept / Cancel buttons
  const actionRow = document.createElement('div');
  actionRow.className = 'flex gap-3';

  const cancelBtn = btn('Cancel', 'ghost');
  cancelBtn.className += ' flex-1';
  cancelBtn.onclick = () => overlay.remove();

  const acceptBtn = btn('Accept Plan', 'primary');
  acceptBtn.className += ' flex-1';
  acceptBtn.onclick = async () => {
    acceptBtn.disabled = true;
    acceptBtn.textContent = 'Saving…';

    try {
      // Build new meal plan entries from the proposal
      const newEntries = (currentResult.plan || []).map(entry => {
        const base = {
          id: crypto.randomUUID(),
          date: entry.date,
          meal: entry.meal,
        };
        if (entry.plainText) {
          base.plainText = entry.plainText;
        } else {
          base.recipeId = entry.recipeId;
        }
        return base;
      });

      // Merge: keep existing entries that don't conflict with new ones
      const plannedDates = new Set(planDates);
      const newSlots = new Set(newEntries.map(e => `${e.date}|${e.meal}`));

      const kept = mealPlans.filter(e => {
        if (!plannedDates.has(e.date)) return true; // outside planned range — keep
        return !newSlots.has(`${e.date}|${e.meal}`); // not conflicting — keep
      });

      await saveMealPlans([...kept, ...newEntries]);
      overlay.remove();
      toastSuccess('Meal plan accepted!');
      onAccepted();
    } catch (err) {
      toastError(err.message || 'Could not save plan. Try again.');
      acceptBtn.disabled = false;
      acceptBtn.textContent = 'Accept Plan';
    }
  };

  actionRow.appendChild(cancelBtn);
  actionRow.appendChild(acceptBtn);
  footer.appendChild(actionRow);

  panel.appendChild(footer);

  overlay.appendChild(panel);
  overlay.onclick = e => { if (e.target === overlay) overlay.remove(); };
  document.body.appendChild(overlay);
}
