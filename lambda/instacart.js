// Lambda: POST /instacart  (HTTP API, Cognito JWT authorizer)
//
// Body: { action: 'retailers', zip }            → { retailers: [{ retailer_key, name, logo }] }
//       { action: 'list', title, items }         → { url }   (Instacart shopping-list page, store pre-selected)
//
// Instacart Developer Platform has no cart-write or checkout endpoint — the
// best it offers is a pre-filled shopping list the user finishes on
// instacart.com. This handler exists so the API key never reaches the browser.
//
// Secrets: INSTACART_API_KEY from AWS Secrets Manager (meal-planner/secrets)
// Env:     INSTACART_HOST — connect.instacart.com (prod key, default)
//                           connect.dev.instacart.tools (development key)
//          LINKBACK_URL   — shown on the Instacart page as "back to partner"

'use strict';

const { Sentry } = require('./lib/sentry');
const logger = require('./lib/logger');
const {
  buildShoppingListPayload,
  withRetailer,
  ValidationError,
} = require('./lib/instacart-utils');

const https = require('https');
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');

const smClient = new SecretsManagerClient({ region: process.env.AWS_REGION || 'us-east-2' });

const INSTACART_HOST = process.env.INSTACART_HOST || 'connect.instacart.com';
const LINKBACK_URL = process.env.LINKBACK_URL || 'https://meals.jaetill.com';

const ALLOWED_ORIGINS = new Set(['https://meals.jaetill.com', 'http://localhost:5173']);

let _secrets;
async function getSecrets() {
  if (!_secrets) {
    const res = await smClient.send(
      new GetSecretValueCommand({ SecretId: 'meal-planner/secrets' }),
    );
    _secrets = JSON.parse(res.SecretString);
  }
  return _secrets;
}

function corsHeaders(event) {
  const origin = event.headers?.origin || event.headers?.Origin || '';
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGINS.has(origin)
      ? origin
      : 'https://meals.jaetill.com',
    'Access-Control-Allow-Methods': 'POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    'Content-Type': 'application/json',
  };
}

function respond(statusCode, body, headers) {
  return { statusCode, headers, body: JSON.stringify(body) };
}

// HTTP API JWT authorizer exposes claims at requestContext.authorizer.jwt.claims.
// cognito:groups arrives as an array or as the string "[a b]".
function requireGroup(event, group) {
  const claim = event.requestContext?.authorizer?.jwt?.claims?.['cognito:groups'];
  const groups = Array.isArray(claim)
    ? claim
    : String(claim || '')
        .replace(/^\[|\]$/g, '')
        .split(/[\s,]+/)
        .filter(Boolean);
  return groups.includes(group);
}

function idpRequest(method, path, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const req = https.request(
      {
        hostname: INSTACART_HOST,
        path,
        method,
        headers: {
          Authorization: `Bearer ${_secrets.INSTACART_API_KEY}`,
          Accept: 'application/json',
          ...(data && {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(data),
          }),
        },
      },
      (res) => {
        let out = '';
        res.on('data', (c) => (out += c));
        res.on('end', () => resolve({ statusCode: res.statusCode, body: out }));
      },
    );
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

// Upstream failures are logged with the response body (for debugging) but
// never forwarded to the browser.
function upstreamError(op, res) {
  logger.error('instacart.upstream_error', {
    op,
    status: res.statusCode,
    body: String(res.body || '').slice(0, 500),
  });
  return new Error(`IDP ${op} returned ${res.statusCode}`);
}

async function findRetailers(zip) {
  const res = await idpRequest(
    'GET',
    `/idp/v1/retailers?postal_code=${encodeURIComponent(zip)}&country_code=US`,
  );
  if (res.statusCode !== 200) throw upstreamError('retailers', res);
  const json = JSON.parse(res.body);
  return (json.retailers || []).map((r) => ({
    retailer_key: r.retailer_key,
    name: r.name,
    logo: r.retailer_logo_url || '',
  }));
}

async function createList({ title, items, retailerKey }) {
  const payload = buildShoppingListPayload({ title, items, linkbackUrl: LINKBACK_URL });
  const res = await idpRequest('POST', '/idp/v1/products/products_link', payload);
  if (res.statusCode !== 200) throw upstreamError('products_link', res);
  const json = JSON.parse(res.body);
  if (!json.products_link_url) throw new Error('IDP response missing products_link_url');
  return withRetailer(json.products_link_url, retailerKey);
}

async function handleRetailers(body) {
  if (!/^\d{5}$/.test(String(body.zip || ''))) {
    return [400, { error: 'zip must be 5 digits' }];
  }
  return [200, { retailers: await findRetailers(body.zip) }];
}

async function handleList(body) {
  if (!Array.isArray(body.items) || body.items.length === 0) {
    return [400, { error: 'items required' }];
  }
  const url = await createList({
    title: body.title,
    items: body.items,
    retailerKey: body.retailerKey,
  });
  logger.info('instacart.list.created', {
    count: body.items.length,
    retailer: body.retailerKey || null,
  });
  return [200, { url }];
}

const ACTIONS = { retailers: handleRetailers, list: handleList };

function parseBody(event) {
  try {
    return JSON.parse(event.body || '{}');
  } catch {
    return null;
  }
}

exports.handler = Sentry.wrapHandler(async (event) => {
  const headers = corsHeaders(event);
  const method = event.requestContext?.http?.method || event.httpMethod;

  if (method === 'OPTIONS') return { statusCode: 200, headers, body: '' };

  if (!requireGroup(event, 'meal-planner-users')) {
    return respond(403, { error: 'Forbidden: not a meal-planner-users group member' }, headers);
  }

  const body = parseBody(event);
  if (!body) return respond(400, { error: 'Invalid JSON' }, headers);

  const action = ACTIONS[body.action];
  if (!action) return respond(400, { error: 'unknown action' }, headers);

  try {
    await getSecrets();
    if (!_secrets.INSTACART_API_KEY) {
      return respond(503, { error: 'Instacart is not configured yet' }, headers);
    }
    const [status, payload] = await action(body);
    return respond(status, payload, headers);
  } catch (e) {
    if (e instanceof ValidationError) {
      return respond(e.statusCode, { error: e.message }, headers);
    }
    logger.error('instacart.failed', { action: body.action, error: e.message });
    Sentry.captureException(e);
    return respond(502, { error: 'Instacart request failed' }, headers);
  }
});
