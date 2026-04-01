import { Amplify, Auth } from 'aws-amplify';
import amplifyConfig from './config.js';
import { loadRecipes, loadMealPlans, loadActiveGroup, loadStaples, loadAisleOrders } from './data/index.js';
import { renderRecipes } from './components/renderRecipes.js';
import { renderMealPlan } from './components/renderMealPlan.js';
import { renderGroceryList } from './components/renderGroceryList.js';
import { renderGroupSettings } from './components/renderGroupSettings.js';

Amplify.configure(amplifyConfig);

document.getElementById('sign-out-btn').addEventListener('click', async () => {
  await Auth.signOut();
  window.location.href = 'login.html';
});

// ── Nav ───────────────────────────────────────────────────

const navRecipes  = document.getElementById('nav-recipes');
const navMealPlan = document.getElementById('nav-mealplan');
const navGrocery  = document.getElementById('nav-grocery');
const navGroup    = document.getElementById('nav-group');

function setActiveNav(active) {
  const activeClass  = 'text-green-600';
  const inactiveClass = 'text-gray-400';
  navRecipes.className  = `flex-1 flex flex-col items-center py-2 text-xs font-medium gap-0.5 ${active === 'recipes'  ? activeClass : inactiveClass}`;
  navMealPlan.className = `flex-1 flex flex-col items-center py-2 text-xs font-medium gap-0.5 ${active === 'mealplan' ? activeClass : inactiveClass}`;
  navGrocery.className  = `flex-1 flex flex-col items-center py-2 text-xs font-medium gap-0.5 ${active === 'grocery'  ? activeClass : inactiveClass}`;
  navGroup.className    = `flex-1 flex flex-col items-center py-2 text-xs font-medium gap-0.5 ${active === 'group'    ? activeClass : inactiveClass}`;
}

navRecipes.onclick  = () => { setActiveNav('recipes');  renderRecipes(); };
navMealPlan.onclick = () => { setActiveNav('mealplan'); renderMealPlan(); };
navGrocery.onclick  = () => { setActiveNav('grocery');  renderGroceryList(); };
navGroup.onclick    = () => { setActiveNav('group');    renderGroupSettings(); };

// ── Init ──────────────────────────────────────────────────

async function init() {
  try {
    await Auth.currentAuthenticatedUser();
  } catch {
    window.location.href = 'login.html';
    return;
  }

  try {
    await loadActiveGroup();
  } catch (err) {
    console.error('Could not load group:', err);
  }
  await Promise.allSettled([loadRecipes(), loadMealPlans(), loadStaples(), loadAisleOrders()]);

  setActiveNav('recipes');
  renderRecipes();
}

window.addEventListener('DOMContentLoaded', init);
