import { handleCallback } from './auth.js';

(async () => {
  const status = document.getElementById('status');
  try {
    await handleCallback();
    status.textContent = 'Signed in. Redirecting…';
    window.location.replace('/');
  } catch (err) {
    console.error(err);
    status.textContent = `Sign-in failed: ${err.message}`;
  }
})();
