import { Auth } from 'aws-amplify';
import { API_BASE } from '../config.js';

const BUCKET      = 'https://meals.jaetill.com';
const SAVE_URL    = 'https://e2h43o5aje.execute-api.us-east-2.amazonaws.com/prod/save';
const IMPORT_URL  = 'https://e2h43o5aje.execute-api.us-east-2.amazonaws.com/prod/import';
const GROUPS_URL  = 'https://e2h43o5aje.execute-api.us-east-2.amazonaws.com/prod/groups';
const COOK_URL    = 'https://e2h43o5aje.execute-api.us-east-2.amazonaws.com/prod/cook';

// ── Active group ──────────────────────────────────────────

export let activeGroup = null; // { groupId, name, role }
export let allGroups   = [];   // all groups the user belongs to
export let currentUsername = null;

export async function loadActiveGroup() {
  const session = await Auth.currentSession();
  const token   = session.getIdToken().getJwtToken();
  const user = await Auth.currentAuthenticatedUser();
  currentUsername = user.username;

  // Fetch user's groups from Lambda
  const res = await fetch(GROUPS_URL, { headers: { Authorization: token } });
  if (!res.ok) throw new Error(`Groups fetch failed: ${res.status}`);
  const { groups } = await res.json();
  allGroups = groups;

  if (groups.length > 0) {
    const savedId = localStorage.getItem('activeGroupId');
    activeGroup   = groups.find(g => g.groupId === savedId) || groups[0];
    return activeGroup;
  }

  // First time: create a default group, then migrate existing flat data
  const createRes = await fetch(GROUPS_URL, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', Authorization: token },
    body:    JSON.stringify({ action: 'create', name: 'My Kitchen' }),
  });
  if (!createRes.ok) throw new Error(`Group creation failed: ${createRes.status}`);
  const { group } = await createRes.json();
  activeGroup = group;

  // Migrate existing flat-file data into the new group
  await migrateToGroup(token);

  return activeGroup;
}

export async function switchGroup(groupId) {
  const target = allGroups.find(g => g.groupId === groupId);
  if (!target) throw new Error('Group not found');
  activeGroup = target;
  localStorage.setItem('activeGroupId', groupId);
  await Promise.allSettled([loadRecipes(), loadMealPlans()]);
}

async function migrateToGroup(token) {
  try {
    const [recipesData, plansData] = await Promise.all([
      fetchJSONRaw('recipes.json'),
      fetchJSONRaw('meal-plans.json'),
    ]);
    if (recipesData?.length > 0 || plansData?.length > 0) {
      await Promise.all([
        saveJSON('recipes.json', recipesData || []),
        saveJSON('meal-plans.json', plansData || []),
      ]);
    }
  } catch { /* non-fatal — migration best-effort */ }
}

// ── Read (public S3) ──────────────────────────────────────

async function fetchJSONRaw(key) {
  const res = await fetch(`${BUCKET}/${key}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`S3 fetch failed: ${res.status}`);
  return res.json();
}

async function fetchJSON(key) {
  const path = activeGroup ? `groups/${activeGroup.groupId}/${key}` : key;
  const res = await fetch(`${BUCKET}/${path}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`S3 fetch failed: ${res.status}`);
  return res.json();
}

// ── Write (via Lambda) ────────────────────────────────────

async function saveJSON(key, data) {
  const session = await Auth.currentSession();
  const token   = session.getIdToken().getJwtToken();
  const body    = { key, data };
  if (activeGroup) body.groupId = activeGroup.groupId;

  const res = await fetch(SAVE_URL, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', Authorization: token },
    body:    JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Save failed: ${res.status}`);
}

// ── Staples ───────────────────────────────────────────────

export let staples = [];

export async function loadStaples() {
  const data = await fetchJSON('staples.json');
  staples = data || [];
  return staples;
}

export async function saveStaples(updated) {
  await saveJSON('staples.json', updated);
  staples = updated;
}

// ── Meal Plans ────────────────────────────────────────────

export let mealPlans = [];

export async function loadMealPlans() {
  const data = await fetchJSON('meal-plans.json');
  mealPlans = data || [];
  return mealPlans;
}

export async function saveMealPlans(updated) {
  await saveJSON('meal-plans.json', updated);
  mealPlans = updated;
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

// ── Group management helpers (used by UI) ─────────────────

export async function createGroupInvite(groupId) {
  const session = await Auth.currentSession();
  const token   = session.getIdToken().getJwtToken();
  const res = await fetch(GROUPS_URL, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', Authorization: token },
    body:    JSON.stringify({ action: 'invite', groupId }),
  });
  if (!res.ok) throw new Error(`Invite failed: ${res.status}`);
  return res.json(); // { code, expiresAt }
}

export async function joinGroup(code) {
  const session = await Auth.currentSession();
  const token   = session.getIdToken().getJwtToken();
  const res = await fetch(GROUPS_URL, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', Authorization: token },
    body:    JSON.stringify({ action: 'join', code }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Join failed: ${res.status}`);
  }
  const data = await res.json();
  if (data.group && !allGroups.some(g => g.groupId === data.group.groupId)) {
    allGroups.push(data.group);
  }
  return data; // { group }
}

export async function fetchGroupMembers(groupId) {
  const session = await Auth.currentSession();
  const token   = session.getIdToken().getJwtToken();
  const res = await fetch(`${GROUPS_URL}?action=members&groupId=${groupId}`, {
    headers: { Authorization: token },
  });
  if (!res.ok) throw new Error(`Members fetch failed: ${res.status}`);
  return res.json(); // { members, name }
}

export async function shareRecipe(recipe, targetUsername) {
  const session = await Auth.currentSession();
  const token   = session.getIdToken().getJwtToken();
  const res = await fetch(GROUPS_URL, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', Authorization: token },
    body:    JSON.stringify({ action: 'share', targetUsername, recipe }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Share failed: ${res.status}`);
  }
  return res.json();
}

export async function fetchIncomingShares() {
  const session = await Auth.currentSession();
  const token   = session.getIdToken().getJwtToken();
  const res = await fetch(`${GROUPS_URL}?action=incoming`, { headers: { Authorization: token } });
  if (!res.ok) return [];
  const { shares } = await res.json();
  return shares || [];
}

export async function acceptIncomingShare(shareId) {
  if (!activeGroup) throw new Error('No active group');
  const session = await Auth.currentSession();
  const token   = session.getIdToken().getJwtToken();
  const res = await fetch(GROUPS_URL, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', Authorization: token },
    body:    JSON.stringify({ action: 'acceptShare', shareId, groupId: activeGroup.groupId }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Accept failed: ${res.status}`);
  }
  const { recipe } = await res.json();
  // Update in-memory recipes
  recipes.push(recipe);
  return recipe;
}

export async function dismissIncomingShare(shareId) {
  const session = await Auth.currentSession();
  const token   = session.getIdToken().getJwtToken();
  const res = await fetch(GROUPS_URL, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', Authorization: token },
    body:    JSON.stringify({ action: 'dismissShare', shareId }),
  });
  if (!res.ok) throw new Error(`Dismiss failed: ${res.status}`);
}

// ── Duration helpers ──────────────────────────────────────

export function parseDurationFromText(text) {
  if (!text) return null;
  const hourMin = text.match(/(\d+)\s*(?:hour|hr)s?\s*(?:and\s*)?(\d+)\s*(?:minute|min)s?/i);
  if (hourMin) return parseInt(hourMin[1]) * 3600 + parseInt(hourMin[2]) * 60;
  const hour = text.match(/\b(?:for|about)\s+(\d+)\s*(?:hour|hr)s?|(\d+)\s*(?:hour|hr)s?/i);
  if (hour) return parseInt(hour[1] || hour[2]) * 3600;
  const min = text.match(/\b(?:for|about)\s+(\d+)\s*(?:minute|min)s?|(\d+)\s*(?:minute|min)s?/i);
  if (min) return parseInt(min[1] || min[2]) * 60;
  const sec = text.match(/\b(?:for|about)\s+(\d+)\s*(?:second|sec)s?|(\d+)\s*(?:second|sec)s?/i);
  if (sec) return parseInt(sec[1] || sec[2]);
  return null;
}

export function formatDuration(seconds) {
  if (!seconds) return '';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h && m) return `${h}h ${m}m`;
  if (h) return `${h}h`;
  return `${m}m`;
}

// ── Cook session ──────────────────────────────────────────

async function cookPost(action, extra = {}) {
  const session = await Auth.currentSession();
  const token   = session.getIdToken().getJwtToken();
  const res = await fetch(COOK_URL, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', Authorization: token },
    body:    JSON.stringify({ action, ...extra }),
  });
  if (!res.ok) throw new Error(`Cook session error: ${res.status}`);
  return res.json();
}

export const startCookSession   = (recipe) => cookPost('start', { recipe });
export const advanceCookSession = ()       => cookPost('advance');
export const backCookSession    = ()       => cookPost('back');

// ── Data factories ────────────────────────────────────────

export function newRecipe(overrides = {}) {
  return {
    id:          crypto.randomUUID(),
    name:        '',
    description: '',
    servings:    4,
    prepTime:    '',
    cookTime:    '',
    source:      '',
    photo:       null,
    rating:      null,
    tags:        [],
    ingredients: [],
    directions:  [],
    notes:       '',
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
    section:     '',
    packageSize: '',
    calories:      null,
    protein:       null,
    fat:           null,
    saturatedFat:  null,
    cholesterol:   null,
    sodium:        null,
    carbs:         null,
    fiber:         null,
    sugar:         null,
    ...overrides,
  };
}
