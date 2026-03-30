// Lambda: MealPlannerSave — handles three routes via path detection
//   POST /save   — write recipes.json, meal-plans.json, or staples.json for a group
//   POST /import — fetch a URL, extract Schema.org recipe, fall back to Claude
//   POST /cook   — read/write cook session at cook-sessions/{userId}.json
//
// Auth: Cognito authorizer — userId from event.requestContext.authorizer.claims['cognito:username']
// Environment variables: ANTHROPIC_API_KEY

const { S3Client, PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const https = require('https');

const BUCKET       = 'jaetill-meal-planner';
const ALLOWED_KEYS = ['recipes.json', 'meal-plans.json', 'staples.json'];
const UUID_RE      = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const s3           = new S3Client({ region: 'us-east-2' });

const HTML_ENTITIES = {
  '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': "'",
  '&nbsp;': ' ', '&frac12;': '½', '&frac14;': '¼', '&frac34;': '¾',
  '&deg;': '°', '&mdash;': '—', '&ndash;': '–', '&hellip;': '…',
  '&rsquo;': "'", '&lsquo;': "'", '&rdquo;': '"', '&ldquo;': '"',
};
function decodeHtml(str) {
  if (!str) return str;
  return str
    .replace(/&[a-z0-9#]+;/gi, e => HTML_ENTITIES[e.toLowerCase()] ?? e)
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)));
}

const CORS = {
  'Access-Control-Allow-Origin':  'https://meals.jaetill.com',
  'Access-Control-Allow-Methods': 'POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Content-Type': 'application/json',
};

// ── Helpers ───────────────────────────────────────────────

function parseDurationFromText(text) {
  if (!text) return null;
  const hourMin = text.match(/(\d+)\s*(?:hour|hr)s?\s*(?:and\s*)?(\d+)\s*(?:minute|min)s?/i);
  if (hourMin) return parseInt(hourMin[1]) * 3600 + parseInt(hourMin[2]) * 60;
  const hour = text.match(/\b(?:for|about)\s+(\d+)\s*(?:hour|hr)s?|(\d+)\s*(?:hour|hr)s?/i);
  if (hour) return parseInt(hour[1] || hour[2]) * 3600;
  const min = text.match(/\b(?:for|about)\s+(\d+)\s*(?:minute|min)s?|(\d+)\s*(?:minute|min)s?/i);
  if (min) return parseInt(min[1] || min[2]) * 60;
  const sec = text.match(/\b(?:for|about)\s+(\d+)\s*(?:second|sec)s?|(\d+)\s*(?:second|sec)s?/i);
  if (sec) return parseInt(sec[1] || sec[2]);
  return null;
}

async function s3Get(key) {
  const res = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
  const body = await res.Body.transformToString();
  return JSON.parse(body);
}

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

function fetchImageBuffer(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MealPlannerBot/1.0)' },
    }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchImageBuffer(res.headers.location).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`));
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => resolve({
        buffer:      Buffer.concat(chunks),
        contentType: res.headers['content-type']?.split(';')[0] || 'image/jpeg',
      }));
    });
    req.on('error', reject);
    req.setTimeout(10000, () => { req.destroy(); reject(new Error('Image fetch timeout')); });
  });
}

async function storePhoto(photoUrl, recipeId) {
  if (!photoUrl) return null;
  try {
    const { buffer, contentType } = await fetchImageBuffer(photoUrl);
    if (!contentType.startsWith('image/')) return null;
    await s3.send(new PutObjectCommand({
      Bucket: BUCKET, Key: `photos/${recipeId}`,
      Body: buffer, ContentType: contentType,
    }));
    return `https://meals.jaetill.com/photos/${recipeId}`;
  } catch {
    return null;
  }
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
    const text = typeof step === 'string' ? step : (step.text || step.name || '');
    return { text, duration: parseDurationFromText(text) };
  }).filter(s => s.text);

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
      CacheControl: 'no-cache, no-store, must-revalidate',
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
      // Normalize ingredients and directions
      recipe.ingredients = (recipe.ingredients || []).map(ing => ({
        id: crypto.randomUUID(),
        quantity: ing.quantity || '',
        unit: ing.unit || '',
        name: ing.name || '',
        preparation: ing.preparation || '',
        packageSize: ing.packageSize || '',
        calories: null, protein: null, fat: null, carbs: null,
      }));
      recipe.directions = (recipe.directions || []).map(d => {
        const text = typeof d === 'string' ? d : (d.text || '');
        return { text, duration: parseDurationFromText(text) };
      }).filter(d => d.text);
    }

    recipe.id        = crypto.randomUUID();
    recipe.createdAt = Date.now();
    recipe.photo     = await storePhoto(recipe.photo, recipe.id);

    return { statusCode: 200, headers: CORS, body: JSON.stringify({ recipe }) };
  } catch (err) {
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: err.message }) };
  }
}

async function handleCookSession(event) {
  const userId = event.requestContext?.authorizer?.claims?.['cognito:username'];
  if (!userId) return { statusCode: 401, headers: CORS, body: JSON.stringify({ error: 'Unauthorized' }) };

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Invalid JSON' }) }; }

  const s3Key = `cook-sessions/${userId}.json`;

  if (body.action === 'start') {
    const { recipe } = body;
    if (!recipe) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Missing recipe' }) };
    const session = {
      recipeId:    recipe.id,
      recipeName:  recipe.name,
      stepIndex:   0,
      steps:       (recipe.directions || []).map(d => {
        const text = decodeHtml(typeof d === 'string' ? d : (d.text || ''));
        return { text, duration: parseDurationFromText(text) };
      }).filter(d => d.text),
      ingredients: (recipe.ingredients || []).map(({ quantity, unit, name }) => ({ quantity, unit, name })),
      startedAt:   Date.now(),
    };
    await s3.send(new PutObjectCommand({
      Bucket: BUCKET, Key: s3Key, Body: JSON.stringify(session), ContentType: 'application/json', CacheControl: 'no-cache, no-store, must-revalidate',
    }));
    return { statusCode: 200, headers: CORS, body: JSON.stringify({ session }) };
  }

  let session;
  try { session = await s3Get(s3Key); }
  catch { return { statusCode: 404, headers: CORS, body: JSON.stringify({ error: 'No active session' }) }; }

  if (body.action === 'advance') {
    session.stepIndex = Math.min(session.stepIndex + 1, session.steps.length - 1);
    await s3.send(new PutObjectCommand({
      Bucket: BUCKET, Key: s3Key, Body: JSON.stringify(session), ContentType: 'application/json', CacheControl: 'no-cache, no-store, must-revalidate',
    }));
  } else if (body.action === 'back') {
    session.stepIndex = Math.max(session.stepIndex - 1, 0);
    await s3.send(new PutObjectCommand({
      Bucket: BUCKET, Key: s3Key, Body: JSON.stringify(session), ContentType: 'application/json', CacheControl: 'no-cache, no-store, must-revalidate',
    }));
  }
  // 'get' action falls through and returns current session

  return { statusCode: 200, headers: CORS, body: JSON.stringify({ session }) };
}

// ── Main handler ──────────────────────────────────────────

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: CORS, body: '' };
  }

  const path = event.path || '';
  if (path.endsWith('/import'))  return handleImport(event);
  if (path.endsWith('/cook'))    return handleCookSession(event);
  return handleSave(event);
};
