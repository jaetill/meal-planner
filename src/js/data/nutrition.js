import { API_BASE } from '../config.js';
import { saveRecipes, recipes } from './index.js';

const FIELDS = ['calories', 'protein', 'fat', 'saturatedFat',
                 'cholesterol', 'sodium', 'carbs', 'fiber', 'sugar'];

// ── Fetch & persist ────────────────────────────────────────

export async function populateRecipeNutrition(recipe) {
  const ingredients = (recipe.ingredients || []).filter(
    ing => ing.name && ing.quantity && ing.calories == null
  );
  if (ingredients.length === 0) return;

  for (const ing of ingredients) {
    try {
      const url = `${API_BASE}/nutrition?name=${encodeURIComponent(ing.name)}`
        + `&quantity=${encodeURIComponent(ing.quantity)}`
        + `&unit=${encodeURIComponent(ing.unit || '')}`;
      const res  = await fetch(url);
      if (!res.ok) continue;
      const { nutrition } = await res.json();
      if (nutrition) Object.assign(ing, nutrition);
    } catch { /* skip — non-fatal */ }
  }

  try { await saveRecipes([...recipes]); } catch { /* non-fatal */ }
}

// ── Per-serving totals ─────────────────────────────────────

export function calcNutritionPerServing(recipe) {
  const servings = recipe.servings || 1;
  const totals   = Object.fromEntries(FIELDS.map(f => [f, 0]));
  let hasAny     = false;

  for (const ing of (recipe.ingredients || [])) {
    for (const field of FIELDS) {
      if (ing[field] != null) { totals[field] += ing[field]; hasAny = true; }
    }
  }

  if (!hasAny) return null;

  return Object.fromEntries(
    FIELDS.map(f => [f, Math.round(totals[f] / servings * 10) / 10])
  );
}

// ── Daily totals across multiple recipe entries ────────────

export function calcDailyNutrition(entries, recipeList, defaultServings) {
  const totals = Object.fromEntries(FIELDS.map(f => [f, 0]));
  let hasAny   = false;

  for (const entry of entries) {
    const recipe = recipeList.find(r => r.id === entry.recipeId);
    if (!recipe) continue;
    const perServing = calcNutritionPerServing(recipe);
    if (!perServing) continue;
    const servings = entry.servings ?? defaultServings;
    for (const field of FIELDS) {
      totals[field] += (perServing[field] || 0) * servings;
    }
    hasAny = true;
  }

  if (!hasAny) return null;
  return Object.fromEntries(FIELDS.map(f => [f, Math.round(totals[f])]));
}
