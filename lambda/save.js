const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const https = require('https');

const BUCKET       = 'jaetill-meal-planner';
const ALLOWED_KEYS = ['recipes.json', 'meal-plans.json'];
const UUID_RE      = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const s3           = new S3Client({ region: 'us-east-2' });

const CORS = {
  'Access-Control-Allow-Origin':  'https://meals.jaetill.com',
  'Access-Control-Allow-Methods': 'POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Content-Type': 'application/json',
};

// ── Helpers ───────────────────────────────────────────────

function httpsGet(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; MealPlannerBot/1.0)',
        'Accept': 'text/html,application/xhtml+xml',
      },
    }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return httpsGet(res.headers.location).then(resolve).catch(reject);
      }
      let body = '';
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => resolve(body));
    });
    req.on('error', reject);
    req.setTimeout(8000, () => { req.destroy(); reject(new Error('Fetch timeout')); });
  });
}

function callClaude(prompt) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({
      model:      'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages:   [{ role: 'user', content: prompt }],
    });

    const req = https.request({
      hostname: 'api.anthropic.com',
      path:     '/v1/messages',
      method:   'POST',
      headers:  {
        'Content-Type':      'application/json',
        'x-api-key':         process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
    }, res => {
      let body = '';
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => {
        try {
          const data = JSON.parse(body);
          resolve(data.content?.[0]?.text || '');
        } catch { reject(new Error('Claude response parse error')); }
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

function extractSchemaRecipe(html) {
  const matches = html.matchAll(/<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi);
  for (const match of matches) {
    try {
      const json = JSON.parse(match[1]);
      const items = Array.isArray(json) ? json : [json, ...(json['@graph'] || [])];
      for (const item of items) {
        if (item['@type'] === 'Recipe' || (Array.isArray(item['@type']) && item['@type'].includes('Recipe'))) {
          return item;
        }
      }
    } catch {}
  }
  return null;
}

const UNITS = [
  'teaspoons','teaspoon','tsp',
  'tablespoons','tablespoon','tbsp',
  'cups','cup','c',
  'fluid ounces','fluid ounce','fl oz',
  'ounces','ounce','oz',
  'pounds','pound','lb','lbs',
  'grams','gram','g',
  'kilograms','kilogram','kg',
  'milliliters','milliliter','ml',
  'liters','liter','l',
  'pinches','pinch',
  'dashes','dash',
  'cans','can',
  'packages','package','pkg',
  'slices','slice',
  'pieces','piece',
  'cloves','clove',
  'sprigs','sprig',
  'bunches','bunch',
  'stalks','stalk',
  'heads','head',
  'inches','inch',
];

// Normalize full unit names to abbreviated forms used in the UI select
const UNIT_NORMALIZE = {
  'teaspoons': 'tsp',  'teaspoon': 'tsp',
  'tablespoons': 'tbsp', 'tablespoon': 'tbsp',
  'cups': 'cup',
  'fluid ounces': 'fl oz', 'fluid ounce': 'fl oz',
  'ounces': 'oz', 'ounce': 'oz',
  'pounds': 'lb', 'pound': 'lb', 'lbs': 'lb',
  'grams': 'g', 'gram': 'g',
  'kilograms': 'kg', 'kilogram': 'kg',
  'milliliters': 'ml', 'milliliter': 'ml',
  'liters': 'l', 'liter': 'l',
  'pinches': 'pinch',
  'dashes': 'dash',
  'cans': 'can',
  'packages': 'pkg', 'package': 'pkg',
  'slices': 'slice',
  'pieces': 'piece',
  'cloves': 'clove',
  'sprigs': 'sprig',
  'bunches': 'bunch',
  'stalks': 'stalk',
  'heads': 'head',
  'inches': 'inch',
};

// Sort longest first so "tablespoons" matches before "tablespoon"
const UNITS_SORTED = [...UNITS].sort((a, b) => b.length - a.length);
const UNITS_PATTERN = UNITS_SORTED.map(u => u.replace(/\s/g, '\\s')).join('|');
const ING_REGEX = new RegExp(
  `^([\\d½¼¾⅓⅔\\s\\/\\.]+)?\\s*(${UNITS_PATTERN})\\.?\\s+(.+)$`, 'i'
);

function parseIngredientLine(line) {
  const match = line.match(ING_REGEX);
  let quantity = '', unit = '', rest = line.trim();

  if (match) {
    quantity = match[1]?.trim() || '';
    const rawUnit = match[2]?.trim() || '';
    unit     = UNIT_NORMALIZE[rawUnit.toLowerCase()] || rawUnit;
    rest     = match[3]?.trim() || '';
  } else {
    // No unit — try to grab leading number as quantity
    const numMatch = line.match(/^([\d½¼¾⅓⅔\/\.\s]+)\s+(.+)$/);
    if (numMatch) {
      quantity = numMatch[1].trim();
      rest     = numMatch[2].trim();
    }
  }

  // Split preparation at comma: "onions, chopped" → name="onions", preparation="chopped"
  const commaIdx = rest.indexOf(',');
  let name = rest, preparation = '';
  if (commaIdx > 0) {
    name        = rest.slice(0, commaIdx).trim();
    preparation = rest.slice(commaIdx + 1).trim();
  }

  // Strip filler phrases that aren't real preparation instructions
  const PREP_NOISE = /^(or more as needed|as needed|or to taste|to taste|or more|if needed)$/i;
  if (PREP_NOISE.test(preparation)) preparation = '';

  return {
    id: crypto.randomUUID(),
    quantity, unit, name, preparation,
    packageSize: '',
    calories: null, protein: null, fat: null, carbs: null,
  };
}

function parseSchemaRecipe(schema) {
  const ingredients = (schema.recipeIngredient || []).map(parseIngredientLine);

  const directions = (schema.recipeInstructions || []).map(step => {
    if (typeof step === 'string') return step;
    return step.text || step.name || '';
  }).filter(Boolean);

  const image = Array.isArray(schema.image)
    ? (schema.image[0]?.url || schema.image[0])
    : (schema.image?.url || schema.image);

  return {
    name:        schema.name || '',
    servings:    parseInt(schema.recipeYield) || 4,
    prepTime:    parseDuration(schema.prepTime),
    cookTime:    parseDuration(schema.cookTime),
    source:      '',
    photo:       typeof image === 'string' ? image : null,
    tags:        (schema.recipeCategory || schema.recipeCuisine || []),
    ingredients,
    directions,
  };
}

function parseDuration(iso) {
  if (!iso) return '';
  const h = iso.match(/(\d+)H/)?.[1];
  const m = iso.match(/(\d+)M/)?.[1];
  if (h && m) return `${h}h ${m}m`;
  if (h)      return `${h}h`;
  if (m)      return `${m}m`;
  return '';
}

function stripHtml(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .slice(0, 8000); // keep it short for Claude
}

async function parseWithClaude(text, url) {
  const prompt = `Extract a recipe from the following webpage text and return ONLY valid JSON matching this structure:
{
  "name": string,
  "servings": number,
  "prepTime": string (e.g. "15m"),
  "cookTime": string (e.g. "30m"),
  "source": "${url}",
  "photo": string or null,
  "tags": string[],
  "ingredients": [{ "quantity": string, "unit": string, "name": string, "preparation": string, "packageSize": string }],
  "directions": string[]
}

Webpage text:
${text}

Return only the JSON object, no explanation.`;

  const response = await callClaude(prompt);
  const jsonMatch = response.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('Claude did not return valid JSON');
  return JSON.parse(jsonMatch[0]);
}

// ── Route handlers ────────────────────────────────────────

async function handleSave(event) {
  const userId = event.requestContext?.authorizer?.claims?.['cognito:username'];
  if (!userId) return { statusCode: 401, headers: CORS, body: JSON.stringify({ error: 'Unauthorized' }) };

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Invalid JSON' }) }; }

  const { key, data, groupId } = body;
  if (!key || !ALLOWED_KEYS.includes(key))
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: `Invalid key` }) };

  const s3Key = groupId && UUID_RE.test(groupId) ? `groups/${groupId}/${key}` : key;

  try {
    await s3.send(new PutObjectCommand({
      Bucket: BUCKET, Key: s3Key,
      Body: JSON.stringify(data),
      ContentType: 'application/json',
    }));
    return { statusCode: 200, headers: CORS, body: JSON.stringify({ saved: s3Key }) };
  } catch (err) {
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: err.message }) };
  }
}

async function handleImport(event) {
  const userId = event.requestContext?.authorizer?.claims?.['cognito:username'];
  if (!userId) return { statusCode: 401, headers: CORS, body: JSON.stringify({ error: 'Unauthorized' }) };

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Invalid JSON' }) }; }

  const { url } = body;
  if (!url) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Missing url' }) };

  try {
    const html   = await httpsGet(url);
    const schema = extractSchemaRecipe(html);

    let recipe;
    if (schema) {
      recipe = parseSchemaRecipe(schema);
      recipe.source = url;
    } else {
      const text = stripHtml(html);
      recipe = await parseWithClaude(text, url);
      // Normalize ingredients to include id and nutrition fields
      recipe.ingredients = (recipe.ingredients || []).map(ing => ({
        id: crypto.randomUUID(),
        quantity: ing.quantity || '',
        unit: ing.unit || '',
        name: ing.name || '',
        preparation: ing.preparation || '',
        packageSize: ing.packageSize || '',
        calories: null, protein: null, fat: null, carbs: null,
      }));
    }

    recipe.id        = crypto.randomUUID();
    recipe.createdAt = Date.now();

    return { statusCode: 200, headers: CORS, body: JSON.stringify({ recipe }) };
  } catch (err) {
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: err.message }) };
  }
}

// ── Main handler ──────────────────────────────────────────

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: CORS, body: '' };
  }

  const path = event.path || '';
  if (path.endsWith('/import')) return handleImport(event);
  return handleSave(event);
};
