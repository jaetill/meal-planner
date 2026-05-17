// Lambda: GET /locations?zip=<zip>          â€” find nearby Kroger/Harris Teeter stores
//         GET /products?q=<term>&locationId=<id> â€” search products with prices
//
// Secrets: KROGER_CLIENT_ID, KROGER_CLIENT_SECRET from AWS Secrets Manager (meal-planner/secrets)

'use strict';

const { Sentry } = require('./lib/sentry');

const https = require('https');
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');

const smClient = new SecretsManagerClient({ region: 'us-east-2' });

let _secrets;
async function getSecrets() {
  if (!_secrets) {
    const res = await smClient.send(new GetSecretValueCommand({ SecretId: 'meal-planner/secrets' }));
    _secrets = JSON.parse(res.SecretString);
  }
  return _secrets;
}

const KROGER_BASE = 'api.kroger.com';

const ALLOWED_ORIGINS = new Set([
  'https://meals.jaetill.com',
  'http://localhost:5173',
]);

// Cache token in module scope â€” reused across warm Lambda invocations
let cachedToken     = null;
let tokenExpiresAt  = 0;

// â”€â”€ CORS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function corsHeaders(event) {
  const origin = event.headers?.origin || event.headers?.Origin || '';
  return {
    'Access-Control-Allow-Origin':  ALLOWED_ORIGINS.has(origin) ? origin : 'https://meals.jaetill.com',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type':                 'application/json',
  };
}

// â”€â”€ Handler â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

exports.handler = Sentry.wrapHandler(async (event) => {
  const CORS = corsHeaders(event);

  if (event.httpMethod === 'OPTIONS' || event.requestContext?.http?.method === 'OPTIONS') {
    return { statusCode: 200, headers: { ...CORS, 'Access-Control-Allow-Methods': 'GET,OPTIONS' }, body: '' };
  }

  await getSecrets();

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
});

// â”€â”€ Token (client credentials, cached) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

async function getToken() {
  if (cachedToken && Date.now() < tokenExpiresAt - 60_000) return cachedToken;

  const credentials = Buffer.from(`${_secrets.KROGER_CLIENT_ID}:${_secrets.KROGER_CLIENT_SECRET}`).toString('base64');
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

// â”€â”€ Kroger API GET â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

// â”€â”€ HTTP helper â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

// â”€â”€ Respond helper â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function respond(status, body, headers) {
  return { statusCode: status, headers, body: JSON.stringify(body) };
}
