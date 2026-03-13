import { Amplify, Auth } from 'aws-amplify';
import amplifyConfig from './config.js';
import { loadRecipes } from './data/index.js';
import { loadMealPlans } from './data/index.js';
import { renderRecipes } from './components/renderRecipes.js';
import { renderMealPlan } from './components/renderMealPlan.js';

Amplify.configure(amplifyConfig);

document.getElementById('sign-out-btn').addEventListener('click', async () => {
  await Auth.signOut();
  window.location.href = 'login.html';
});

// ── Nav ───────────────────────────────────────────────────

const navRecipes  = document.getElementById('nav-recipes');
const navMealPlan = document.getElementById('nav-mealplan');

function setActiveNav(active) {
  const activeClass  = 'text-green-600';
  const inactiveClass = 'text-gray-400';
  navRecipes.className  = `flex-1 flex flex-col items-center py-2 text-xs font-medium gap-0.5 ${active === 'recipes'  ? activeClass : inactiveClass}`;
  navMealPlan.className = `flex-1 flex flex-col items-center py-2 text-xs font-medium gap-0.5 ${active === 'mealplan' ? activeClass : inactiveClass}`;
}

navRecipes.onclick = () => { setActiveNav('recipes'); renderRecipes(); };
navMealPlan.onclick = () => { setActiveNav('mealplan'); renderMealPlan(); };

// ── Init ──────────────────────────────────────────────────

async function init() {
  try {
    await Auth.currentAuthenticatedUser();
  } catch {
    window.location.href = 'login.html';
    return;
  }

  await Promise.allSettled([loadRecipes(), loadMealPlans()]);

  setActiveNav('recipes');
  renderRecipes();
}

window.addEventListener('DOMContentLoaded', init);
