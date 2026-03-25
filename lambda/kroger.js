// Lambda: GET /locations?zip=<zip>          — find nearby Kroger/Harris Teeter stores
//         GET /products?q=<term>&locationId=<id> — search products with prices
//
// Environment variables required:
//   KROGER_CLIENT_ID     — from developer.kroger.com
//   KROGER_CLIENT_SECRET — from developer.kroger.com

'use strict';

const https = require('https');

const CLIENT_ID     = process.env.KROGER_CLIENT_ID;
const CLIENT_SECRET = process.env.KROGER_CLIENT_SECRET;
const KROGER_BASE   = 'api.kroger.com';

const ALLOWED_ORIGINS = new Set([
  'https://meals.jaetill.com',
  'http://localhost:5173',
]);

// Cache token in module scope — reused across warm Lambda invocations
let cachedToken     = null;
let tokenExpiresAt  = 0;

// ── CORS ──────────────────────────────────────────────────────────────────────

function corsHeaders(event) {
  const origin = event.headers?.origin || event.headers?.Origin || '';
  return {
    'Access-Control-Allow-Origin':  ALLOWED_ORIGINS.has(origin) ? origin : 'https://meals.jaetill.com',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type':                 'application/json',
  };
}

// ── Handler ───────────────────────────────────────────────────────────────────

exports.handler = async (event) => {
  const CORS = corsHeaders(event);

  if (event.httpMethod === 'OPTIONS' || event.requestContext?.http?.method === 'OPTIONS') {
    return { statusCode: 200, headers: { ...CORS, 'Access-Control-Allow-Methods': 'GET,OPTIONS' }, body: '' };
  }

  const path   = event.rawPath || event.path || '';
  const params = event.queryStringParameters || {};

  try {
    const token = await getToken();

    if (path.endsWith('/locations')) {
      const { zip } = params;
      if (!zip) return respond(400, { error: 'zip required' }, CORS);
      const data = await krogerGet(token, `/v1/locations?filter.zipCode.near=${encodeURIComponent(zip)}&filter.limit=10&filter.radiusInMiles=15`);
      return respond(200, data, CORS);
    }

    if (path.endsWith('/products')) {
      const { q, locationId } = params;
      if (!q) return respond(400, { error: 'q required' }, CORS);
      let url = `/v1/products?filter.term=${encodeURIComponent(q)}&filter.limit=10&filter.fulfillment=ais`;
      if (locationId) url += `&filter.locationId=${encodeURIComponent(locationId)}`;
      const data = await krogerGet(token, url);
      return respond(200, data, CORS);
    }

    return respond(404, { error: 'Not found' }, CORS);

  } catch (e) {
    console.error(e);
    return respond(500, { error: e.message }, CORS);
  }
};

// ── Token (client credentials, cached) ───────────────────────────────────────

async function getToken() {
  if (cachedToken && Date.now() < tokenExpiresAt - 60_000) return cachedToken;

  const credentials = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');
  const body        = 'grant_type=client_credentials&scope=product.compact';

  const res = await httpsRequest({
    hostname: KROGER_BASE,
    path:     '/v1/connect/oauth2/token',
    method:   'POST',
    headers:  {
      'Authorization': `Basic ${credentials}`,
      'Content-Type':  'application/x-www-form-urlencoded',
      'Content-Length': Buffer.byteLength(body),
    },
  }, body);

  if (res.statusCode !== 200) {
    throw new Error(`Token fetch failed: ${res.statusCode} ${res.body}`);
  }

  const json        = JSON.parse(res.body);
  cachedToken       = json.access_token;
  tokenExpiresAt    = Date.now() + json.expires_in * 1000;
  return cachedToken;
}

// ── Kroger API GET ─────────────────────────────────────────────────────────────

async function krogerGet(token, path) {
  const res = await httpsRequest({
    hostname: KROGER_BASE,
    path,
    method:   'GET',
    headers:  { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' },
  });

  if (res.statusCode !== 200) {
    throw new Error(`Kroger API ${res.statusCode}: ${res.body}`);
  }

  return JSON.parse(res.body);
}

// ── HTTP helper ───────────────────────────────────────────────────────────────

function httpsRequest(options, body) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ statusCode: res.statusCode, body: data }));
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

// ── Respond helper ────────────────────────────────────────────────────────────

function respond(status, body, headers) {
  return { statusCode: status, headers, body: JSON.stringify(body) };
}
