import { Amplify, Auth } from 'aws-amplify';
import amplifyConfig from './config.js';
import { loadRecipes } from './data/index.js';
import { renderRecipes } from './components/renderRecipes.js';

Amplify.configure(amplifyConfig);

document.getElementById('sign-out-btn').addEventListener('click', async () => {
  await Auth.signOut();
  window.location.href = 'login.html';
});

async function init() {
  try {
    await Auth.currentAuthenticatedUser();
    await loadRecipes();
    renderRecipes();
  } catch (err) {
    window.location.href = 'login.html';
  }
}

window.addEventListener('DOMContentLoaded', init);
