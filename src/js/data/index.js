import { Auth } from 'aws-amplify';

const BUCKET    = 'https://jaetill-meal-planner.s3.us-east-2.amazonaws.com';
const LAMBDA_URL    = 'https://e2h43o5aje.execute-api.us-east-2.amazonaws.com/prod/save';
const IMPORT_URL    = 'https://e2h43o5aje.execute-api.us-east-2.amazonaws.com/prod/import';

// ── Read (public S3) ──────────────────────────────────────

async function fetchJSON(key) {
  const res = await fetch(`${BUCKET}/${key}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`S3 fetch failed: ${res.status}`);
  return res.json();
}

// ── Write (via Lambda) ────────────────────────────────────

async function saveJSON(key, data) {
  if (!LAMBDA_URL) throw new Error('Lambda URL not configured yet.');
  const session = await Auth.currentSession();
  const token   = session.getIdToken().getJwtToken();
  const res = await fetch(LAMBDA_URL, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', Authorization: token },
    body:    JSON.stringify({ key, data }),
  });
  if (!res.ok) throw new Error(`Save failed: ${res.status}`);
}

// ── Recipes ───────────────────────────────────────────────

export let recipes = [];

export async function loadRecipes() {
  const data = await fetchJSON('recipes.json');
  recipes = data || [];
  return recipes;
}

export async function saveRecipes(updated) {
  await saveJSON('recipes.json', updated);
  recipes = updated;
}

export async function importRecipeFromUrl(url) {
  const session = await Auth.currentSession();
  const token   = session.getIdToken().getJwtToken();
  const res = await fetch(IMPORT_URL, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', Authorization: token },
    body:    JSON.stringify({ url }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Import failed: ${res.status}`);
  }
  const { recipe } = await res.json();
  return recipe;
}

export function newRecipe(overrides = {}) {
  return {
    id:          crypto.randomUUID(),
    name:        '',
    servings:    4,
    prepTime:    '',
    cookTime:    '',
    source:      '',
    photo:       null,
    tags:        [],
    ingredients: [],
    directions:  [],
    createdAt:   Date.now(),
    ...overrides,
  };
}

export function newIngredient(overrides = {}) {
  return {
    id:          crypto.randomUUID(),
    quantity:    '',
    unit:        '',
    name:        '',
    preparation: '',
    packageSize: '',
    calories:    null,
    protein:     null,
    fat:         null,
    carbs:       null,
    ...overrides,
  };
}
