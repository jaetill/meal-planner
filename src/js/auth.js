// OAuth 2.0 Authorization Code + PKCE flow against Cognito Hosted UI.
// No client secret — PKCE replaces it for public SPA clients.
//
// Flow: startLogin() → Cognito → /callback.html → handleCallback() → /
//       refresh() rotates tokens; logout() clears local state and hits Cognito's /logout.

import { COGNITO } from './config.js';

const STORAGE = {
  pkceVerifier: 'mp.pkce.verifier',
  state:        'mp.oauth.state',
  idToken:      'mp.id.token',
  accessToken:  'mp.access.token',
  refreshToken: 'mp.refresh.token',
  expiresAt:    'mp.expires.at',
};

// ── Helpers ─────────────────────────────────────────────────────

function base64UrlEncode(input) {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  let str = '';
  for (let i = 0; i < bytes.length; i++) str += String.fromCharCode(bytes[i]);
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function randomString(bytes = 32) {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return base64UrlEncode(arr);
}

async function sha256(text) {
  const data = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return base64UrlEncode(digest);
}

function authBase() {
  return `https://${COGNITO.domain}`;
}

function storeTokens(tokens) {
  if (tokens.id_token)      localStorage.setItem(STORAGE.idToken,      tokens.id_token);
  if (tokens.access_token)  localStorage.setItem(STORAGE.accessToken,  tokens.access_token);
  if (tokens.refresh_token) localStorage.setItem(STORAGE.refreshToken, tokens.refresh_token);
  if (tokens.expires_in) {
    const expiresAt = Date.now() + tokens.expires_in * 1000;
    localStorage.setItem(STORAGE.expiresAt, String(expiresAt));
  }
}

function clearTokens() {
  Object.values(STORAGE).forEach(k => {
    localStorage.removeItem(k);
    sessionStorage.removeItem(k);
  });
}

// ── Public API ──────────────────────────────────────────────────

export async function startLogin() {
  const verifier  = randomString();
  const state     = randomString();
  const challenge = await sha256(verifier);

  sessionStorage.setItem(STORAGE.pkceVerifier, verifier);
  sessionStorage.setItem(STORAGE.state, state);

  const url = new URL(`${authBase()}/oauth2/authorize`);
  url.searchParams.set('client_id',             COGNITO.clientId);
  url.searchParams.set('response_type',         'code');
  url.searchParams.set('scope',                 COGNITO.scopes.join(' '));
  url.searchParams.set('redirect_uri',          COGNITO.redirectUri);
  url.searchParams.set('state',                 state);
  url.searchParams.set('code_challenge',        challenge);
  url.searchParams.set('code_challenge_method', 'S256');

  window.location.assign(url.toString());
}

export async function handleCallback() {
  const params         = new URLSearchParams(window.location.search);
  const code           = params.get('code');
  const returnedState  = params.get('state');
  const expectedState  = sessionStorage.getItem(STORAGE.state);
  const verifier       = sessionStorage.getItem(STORAGE.pkceVerifier);
  const error          = params.get('error');

  if (error) throw new Error(`Cognito returned error: ${error} — ${params.get('error_description') || ''}`);
  if (!code) throw new Error('No authorization code in callback');
  if (!verifier) throw new Error('Missing PKCE verifier — start a fresh sign-in');
  if (returnedState !== expectedState) throw new Error('State mismatch — possible CSRF, aborting');

  const body = new URLSearchParams({
    grant_type:    'authorization_code',
    client_id:     COGNITO.clientId,
    code,
    redirect_uri:  COGNITO.redirectUri,
    code_verifier: verifier,
  });

  const res = await fetch(`${authBase()}/oauth2/token`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token exchange failed (${res.status}): ${text}`);
  }

  storeTokens(await res.json());
  sessionStorage.removeItem(STORAGE.pkceVerifier);
  sessionStorage.removeItem(STORAGE.state);
}

export async function refresh() {
  const refreshToken = localStorage.getItem(STORAGE.refreshToken);
  if (!refreshToken) throw new Error('No refresh token available');

  const body = new URLSearchParams({
    grant_type:    'refresh_token',
    client_id:     COGNITO.clientId,
    refresh_token: refreshToken,
  });

  const res = await fetch(`${authBase()}/oauth2/token`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  if (!res.ok) {
    clearTokens();
    throw new Error(`Refresh failed (${res.status})`);
  }

  // Cognito's refresh response does not include refresh_token — preserve the existing one.
  const tokens = await res.json();
  storeTokens({ ...tokens, refresh_token: refreshToken });
}

export function logout() {
  clearTokens();
  const url = new URL(`${authBase()}/logout`);
  url.searchParams.set('client_id',  COGNITO.clientId);
  url.searchParams.set('logout_uri', COGNITO.logoutUri);
  window.location.assign(url.toString());
}

export function getIdToken() {
  return localStorage.getItem(STORAGE.idToken);
}

export function getAccessToken() {
  return localStorage.getItem(STORAGE.accessToken);
}

export function isAuthenticated() {
  const expiresAt = Number(localStorage.getItem(STORAGE.expiresAt));
  // Treat tokens as expired 60s early to avoid race with the auth server clock.
  return Boolean(getIdToken() && Date.now() < expiresAt - 60_000);
}

export function parseIdToken() {
  const token = getIdToken();
  if (!token) return null;
  const [, payload] = token.split('.');
  if (!payload) return null;
  try {
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(json);
  } catch {
    return null;
  }
}
