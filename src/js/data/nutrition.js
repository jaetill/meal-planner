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

// ── Per-meal totals (grouped by meal type) ──────────────────

export function calcNutritionByMeal(entries, recipeList) {
  const byMeal = {};

  for (const entry of entries) {
    const recipe = recipeList.find(r => r.id === entry.recipeId);
    if (!recipe) continue;
    const perServing = calcNutritionPerServing(recipe);
    if (!perServing) continue;

    if (!byMeal[entry.meal]) {
      byMeal[entry.meal] = Object.fromEntries(FIELDS.map(f => [f, 0]));
    }
    for (const field of FIELDS) {
      byMeal[entry.meal][field] += perServing[field] || 0;
    }
  }

  if (Object.keys(byMeal).length === 0) return null;

  return Object.fromEntries(
    Object.entries(byMeal).map(([meal, totals]) => [
      meal,
      Object.fromEntries(FIELDS.map(f => [f, Math.round(totals[f])]))
    ])
  );
}

// ── Daily totals across multiple recipe entries ────────────

export function calcDailyNutrition(entries, recipeList) {
  const totals = Object.fromEntries(FIELDS.map(f => [f, 0]));
  let hasAny   = false;

  for (const entry of entries) {
    const recipe = recipeList.find(r => r.id === entry.recipeId);
    if (!recipe) continue;
    const perServing = calcNutritionPerServing(recipe);
    if (!perServing) continue;
    for (const field of FIELDS) {
      totals[field] += perServing[field] || 0;
    }
    hasAny = true;
  }

  if (!hasAny) return null;
  return Object.fromEntries(FIELDS.map(f => [f, Math.round(totals[f])]));
}
