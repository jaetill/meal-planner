import { Amplify, Auth } from 'aws-amplify';
import amplifyConfig from './config.js';

Amplify.configure(amplifyConfig);

const errorEl = document.getElementById('error');

function showError(msg) { errorEl.textContent = msg; errorEl.classList.remove('hidden'); }
function clearError()   { errorEl.textContent = ''; errorEl.classList.add('hidden'); }
function show(id) { document.getElementById(id).classList.remove('hidden'); }
function hide(id) { document.getElementById(id).classList.add('hidden'); }

document.getElementById('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  clearError();
  const btn      = document.getElementById('login-btn');
  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value;
  btn.disabled = true;
  btn.textContent = 'Signing in…';
  try {
    await Auth.signIn(username, password);
    window.location.href = 'index.html';
  } catch (err) {
    showError(err.message || 'Sign in failed. Please try again.');
    btn.disabled = false;
    btn.textContent = 'Sign In';
  }
});

document.getElementById('forgot-link').addEventListener('click', () => { clearError(); hide('login-form'); show('forgot-form'); });
document.getElementById('back-to-login').addEventListener('click', () => { clearError(); hide('forgot-form'); show('login-form'); });

let resetUsername = '';

document.getElementById('forgot-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  clearError();
  const btn = document.getElementById('forgot-btn');
  resetUsername = document.getElementById('forgot-username').value.trim();
  btn.disabled = true;
  btn.textContent = 'Sending…';
  try {
    await Auth.forgotPassword(resetUsername);
    hide('forgot-form');
    show('reset-form');
  } catch (err) {
    showError(err.message || 'Could not send reset code.');
    btn.disabled = false;
    btn.textContent = 'Send reset code';
  }
});

document.getElementById('reset-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  clearError();
  const btn         = document.getElementById('reset-btn');
  const code        = document.getElementById('reset-code').value.trim();
  const newPassword = document.getElementById('new-password').value;
  btn.disabled = true;
  btn.textContent = 'Saving…';
  try {
    await Auth.forgotPasswordSubmit(resetUsername, code, newPassword);
    await Auth.signIn(resetUsername, newPassword);
    window.location.href = 'index.html';
  } catch (err) {
    showError(err.message || 'Could not reset password.');
    btn.disabled = false;
    btn.textContent = 'Set new password';
  }
});
