import { Amplify, Auth } from 'aws-amplify';
import amplifyConfig from './config.js';

Amplify.configure(amplifyConfig);

document.getElementById('sign-out-btn').addEventListener('click', async () => {
  await Auth.signOut();
  window.location.href = 'login.html';
});

async function init() {
  try {
    const cognitoUser = await Auth.currentAuthenticatedUser();
    console.log('[App] Signed in as', cognitoUser.username);
    // TODO: load data and render app
    document.getElementById('app-content').innerHTML =
      `<p class="text-gray-500 text-sm text-center py-12">Welcome, ${cognitoUser.attributes?.name || cognitoUser.username}! App coming soon.</p>`;
  } catch (err) {
    window.location.href = 'login.html';
  }
}

window.addEventListener('DOMContentLoaded', init);
