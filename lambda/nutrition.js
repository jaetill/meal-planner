// Lambda: GET /nutrition?name=<name>&quantity=<qty>&unit=<unit>
//
// 1. Searches USDA FoodData Central for the ingredient
// 2. Estimates weight for the given quantity via Claude
// 3. Scales per-100g nutrients to the actual quantity
// 4. Falls back to Claude for full estimation if USDA has no match
//
// Secrets: USDA_API_KEY, ANTHROPIC_API_KEY from AWS Secrets Manager (meal-planner/secrets)

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

const ALLOWED_ORIGINS = new Set([
  'https://meals.jaetill.com',
  'http://localhost:5173',
]);

// USDA nutrient IDs â†’ our field names
const NUTRIENT_MAP = {
  1008: 'calories',
  1003: 'protein',
  1004: 'fat',
  1258: 'saturatedFat',
  1253: 'cholesterol',
  1093: 'sodium',
  1005: 'carbs',
  1079: 'fiber',
  2000: 'sugar',
};

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

  const { name, quantity, unit } = event.queryStringParameters || {};
  if (!name) return respond(400, { error: 'name required' }, CORS);

  try {
    // 1. Try USDA first
    const usdaResult = await searchUSDA(name);

    if (usdaResult) {
      // 2. Convert quantity to grams using unit table â€” no Claude needed
      const grams = convertToGrams(parseFloat(quantity) || 1, unit, name);
      const scale = grams / 100;
      const nutrition = scaleNutrients(usdaResult, scale);
      return respond(200, { nutrition, source: 'usda' }, CORS);
    }

    // 3. Claude fallback â€” only fires when USDA has no match
    const nutrition = await estimateNutritionClaude(quantity, unit, name);
    return respond(200, { nutrition, source: 'claude' }, CORS);

  } catch (e) {
    console.error(e);
    return respond(500, { error: e.message }, CORS);
  }
});

// â”€â”€ USDA search â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

async function searchUSDA(name) {
  const url = `/fdc/v1/foods/search?query=${encodeURIComponent(name)}&pageSize=5&api_key=${_secrets.USDA_API_KEY}`;
  const res  = await httpsRequest({ hostname: 'api.nal.usda.gov', path: url, method: 'GET' });

  if (res.statusCode !== 200) return null;

  const json  = JSON.parse(res.body);
  const foods = json.foods || [];

  // Prefer "SR Legacy" or "Foundation" data types â€” most reliable nutrient data
  const preferred = foods.find(f => f.dataType === 'SR Legacy' || f.dataType === 'Foundation')
    || foods[0];

  if (!preferred) return null;

  // Reject weak matches â€” require at least half the query words to appear in the description
  const queryWords  = name.toLowerCase().split(/\s+/).filter(w => w.length > 2);
  const description = (preferred.description || '').toLowerCase();
  const matchCount  = queryWords.filter(w => description.includes(w)).length;
  if (queryWords.length > 0 && matchCount < Math.ceil(queryWords.length / 2)) return null;

  // Extract nutrients as per-100g values
  const nutrients = {};
  for (const n of (preferred.foodNutrients || [])) {
    const field = NUTRIENT_MAP[n.nutrientId];
    if (field) nutrients[field] = n.value ?? null;
  }

  // Only return if we got at least calories
  return nutrients.calories != null ? nutrients : null;
}

// â”€â”€ Scale per-100g nutrients by weight ratio â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function scaleNutrients(per100g, scale) {
  const result = {};
  for (const [field, val] of Object.entries(per100g)) {
    result[field] = val != null ? Math.round(val * scale * 10) / 10 : null;
  }
  return result;
}

// â”€â”€ Unit â†’ grams conversion table (no Claude needed) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const UNIT_GRAMS = {
  // Weight
  g: 1, gram: 1, grams: 1,
  kg: 1000, kilogram: 1000, kilograms: 1000,
  oz: 28.35, ounce: 28.35, ounces: 28.35,
  lb: 453.6, pound: 453.6, pounds: 453.6,
  // Volume (approximate water density â€” good for liquids, rough for solids)
  ml: 1, milliliter: 1, milliliters: 1,
  l: 1000, liter: 1000, liters: 1000,
  tsp: 5, teaspoon: 5, teaspoons: 5,
  tbsp: 15, tablespoon: 15, tablespoons: 15,
  cup: 240, cups: 240,
  // Common count-based (rough averages)
  clove: 5, cloves: 5,
  slice: 30, slices: 30,
  piece: 50, pieces: 50,
  whole: 100,
  can: 400, cans: 400,
  bunch: 150, bunches: 150,
  sprig: 3, sprigs: 3,
  leaf: 1, leaves: 1,
  stalk: 40, stalks: 40,
  head: 500, heads: 500,
};

function convertToGrams(qty, unit, _name) {
  const key = (unit || '').toLowerCase().trim();
  const gramsPerUnit = UNIT_GRAMS[key];
  if (gramsPerUnit) return qty * gramsPerUnit;
  // Unknown unit â€” default to 100g (one serving equivalent)
  return 100;
}

// â”€â”€ Claude: estimate full nutrition for a quantity â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

async function estimateNutritionClaude(quantity, unit, name) {
  const prompt = `Estimate the nutrition for ${quantity || '1'} ${unit || ''} ${name}.
Reply with ONLY a JSON object with these keys (numbers, no units):
calories, protein, fat, saturatedFat, cholesterol, sodium, carbs, fiber, sugar
All values should be numbers or null if unknown.`.trim();

  const text = await callClaude(prompt);

  try {
    const match = text.match(/\{[\s\S]*\}/);
    return match ? JSON.parse(match[0]) : emptyNutrition();
  } catch {
    return emptyNutrition();
  }
}

function emptyNutrition() {
  return { calories: null, protein: null, fat: null, saturatedFat: null,
           cholesterol: null, sodium: null, carbs: null, fiber: null, sugar: null };
}

// â”€â”€ Claude API â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

async function callClaude(prompt) {
  const body = JSON.stringify({
    model:      'claude-haiku-4-5-20251001',
    max_tokens: 256,
    messages:   [{ role: 'user', content: prompt }],
  });

  const res = await httpsRequest({
    hostname: 'api.anthropic.com',
    path:     '/v1/messages',
    method:   'POST',
    headers:  {
      'x-api-key':         _secrets.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'Content-Type':      'application/json',
      'Content-Length':    Buffer.byteLength(body),
    },
  }, body);

  if (res.statusCode !== 200) throw new Error(`Claude API ${res.statusCode}: ${res.body}`);
  const json = JSON.parse(res.body);
  return json.content?.[0]?.text || '';
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
