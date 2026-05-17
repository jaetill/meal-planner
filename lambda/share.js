// meal-planner-share Lambda
// Secrets: POSTMARK_API_KEY from AWS Secrets Manager (meal-planner/secrets)
// Env vars: FROM_EMAIL (default: jason@jaetill.com)
// API Gateway must have a Cognito authorizer so claims are present.

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

const FROM_EMAIL = process.env.FROM_EMAIL || 'jason@jaetill.com';

const ALLOWED_ORIGINS = new Set(['https://meals.jaetill.com', 'http://localhost:5173']);
const CORS = {
  'Access-Control-Allow-Origin':  'https://meals.jaetill.com',
  'Access-Control-Allow-Methods': 'POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Content-Type': 'application/json',
};

function corsHeaders(event) {
  const origin = event.headers?.origin || event.headers?.Origin || '';
  return { ...CORS, 'Access-Control-Allow-Origin': ALLOWED_ORIGINS.has(origin) ? origin : CORS['Access-Control-Allow-Origin'] };
}

function toSchemaOrg(recipe) {
  const out = {
    '@context': 'https://schema.org',
    '@type':    'Recipe',
    name:       recipe.name,
  };
  if (recipe.description) out.description  = recipe.description;
  if (recipe.servings)    out.recipeYield  = String(recipe.servings);
  if (recipe.prepTime)    out.prepTime     = recipe.prepTime;
  if (recipe.cookTime)    out.cookTime     = recipe.cookTime;
  if (recipe.source)      out.url          = recipe.source;
  if (recipe.tags?.length) out.keywords    = recipe.tags.join(',');
  if (recipe.ingredients?.length) {
    out.recipeIngredient = recipe.ingredients.map(ing => {
      const ingName = ing.preparation ? `${ing.name}, ${ing.preparation}` : ing.name;
      return [ing.quantity, ing.unit, ingName].filter(Boolean).join(' ');
    });
  }
  if (recipe.directions?.length) {
    out.recipeInstructions = recipe.directions
      .map(step => ({ '@type': 'HowToStep', text: typeof step === 'string' ? step : step.text }))
      .filter(s => s.text?.trim());
  }
  return out;
}

function buildTextBody(recipe) {
  const lines = [`${recipe.name}`, ''];
  if (recipe.description) lines.push(recipe.description, '');
  const meta = [
    recipe.servings && `Serves: ${recipe.servings}`,
    recipe.prepTime && `Prep: ${recipe.prepTime}`,
    recipe.cookTime && `Cook: ${recipe.cookTime}`,
  ].filter(Boolean);
  if (meta.length) lines.push(...meta, '');
  if (recipe.ingredients?.length) {
    lines.push('Ingredients:');
    recipe.ingredients.forEach(ing => {
      const ingName = ing.preparation ? `${ing.name}, ${ing.preparation}` : ing.name;
      lines.push('  â€¢ ' + [ing.quantity, ing.unit, ingName].filter(Boolean).join(' '));
    });
    lines.push('');
  }
  if (recipe.directions?.length) {
    lines.push('Directions:');
    recipe.directions.forEach((step, i) => {
      const text = typeof step === 'string' ? step : step.text;
      if (text?.trim()) lines.push(`  ${i + 1}. ${text}`);
    });
    lines.push('');
  }
  lines.push('The attached JSON file can be imported into the Meal Planner app at https://meals.jaetill.com');
  return lines.join('\n');
}

function postmark(msg) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(msg);
    const req  = https.request({
      hostname: 'api.postmarkapp.com',
      path:     '/email',
      method:   'POST',
      headers:  {
        'Accept':                  'application/json',
        'Content-Type':            'application/json',
        'X-Postmark-Server-Token': _secrets.POSTMARK_API_KEY,
        'Content-Length':          Buffer.byteLength(body),
      },
    }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) resolve(JSON.parse(data));
        else reject(new Error(`Postmark ${res.statusCode}: ${data}`));
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// Group authz â€” caller must be in meal-planner-users
function requireGroup(event, group) {
  const claim = event.requestContext?.authorizer?.claims?.['cognito:groups'];
  const groups = Array.isArray(claim)
    ? claim
    : String(claim || '').replace(/^\[|\]$/g, '').split(/[\s,]+/).filter(Boolean);
  return groups.includes(group);
}

exports.handler = Sentry.wrapHandler(async (event) => {
  const headers = corsHeaders(event);

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (!requireGroup(event, 'meal-planner-users')) {
    return { statusCode: 403, headers, body: JSON.stringify({ error: 'Forbidden: not a meal-planner-users group member' }) };
  }

  await getSecrets();

  const userId = event.requestContext?.authorizer?.claims?.['cognito:username'];
  if (!userId) {
    return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  const { recipe, recipientEmail } = body;

  if (!recipe?.name) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'recipe is required' }) };
  }
  if (!recipientEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail)) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Valid recipientEmail is required' }) };
  }

  const schemaRecipe    = toSchemaOrg(recipe);
  const safeName        = recipe.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
  const jsonAttachment  = Buffer.from(JSON.stringify(schemaRecipe, null, 2)).toString('base64');

  await postmark({
    From:          FROM_EMAIL,
    To:            recipientEmail,
    Subject:       `Recipe: ${recipe.name}`,
    TextBody:      buildTextBody(recipe),
    MessageStream: 'outbound',
    Attachments: [{
      Name:        `${safeName}.json`,
      Content:     jsonAttachment,
      ContentType: 'application/json',
    }],
  });

  return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
});
