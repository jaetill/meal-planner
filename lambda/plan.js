// Lambda: meal-planner-plan â€” AI-assisted meal plan generation
//   POST /plan â€” generate or refine a weekly meal plan using Claude
//
// Auth: Cognito authorizer â€” userId from event.requestContext.authorizer.claims['cognito:username']
// Secrets: ANTHROPIC_API_KEY from AWS Secrets Manager (meal-planner/secrets)
// S3 paths read: groups/{groupId}/recipes.json

'use strict';

const { Sentry } = require('./lib/sentry');

const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
const https = require('https');

const smClient = new SecretsManagerClient({ region: 'us-east-2' });

let _secrets;
async function getSecrets() {
  if (!_secrets) {
    const res = await smClient.send(new GetSecretValueCommand({ SecretId: 'meal-planner/secrets' }));
    _secrets = JSON.parse(res.SecretString);
  }
  return _secrets;
}

const BUCKET = 'jaetill-meal-planner';
const s3     = new S3Client({ region: 'us-east-2' });

const CORS = {
  'Access-Control-Allow-Origin':  'https://meals.jaetill.com',
  'Access-Control-Allow-Methods': 'POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Content-Type': 'application/json',
};

// â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

async function s3Get(key) {
  const res = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
  const body = await res.Body.transformToString();
  return JSON.parse(body);
}

function respond(status, body) {
  return { statusCode: status, headers: CORS, body: JSON.stringify(body) };
}

function callClaude(system, userPrompt) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({
      model:      'claude-haiku-4-5-20251001',
      max_tokens: 4096,
      system,
      messages:   [{ role: 'user', content: userPrompt }],
    });

    const req = https.request({
      hostname: 'api.anthropic.com',
      path:     '/v1/messages',
      method:   'POST',
      headers:  {
        'Content-Type':      'application/json',
        'x-api-key':         _secrets.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
    }, res => {
      let body = '';
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => {
        try {
          const data = JSON.parse(body);
          if (data.error) return reject(new Error(data.error.message || 'Claude API error'));
          resolve(data.content?.[0]?.text || '');
        } catch { reject(new Error('Claude response parse error')); }
      });
    });
    req.on('error', reject);
    req.setTimeout(60000, () => { req.destroy(); reject(new Error('Claude timeout')); });
    req.write(payload);
    req.end();
  });
}

// â”€â”€ Recipe digest builder â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function calcNutritionPerServing(recipe) {
  const servings = recipe.servings || 1;
  let cal = 0, pro = 0, fat = 0, carbs = 0, hasAny = false;
  for (const ing of (recipe.ingredients || [])) {
    if (ing.calories != null) { cal += ing.calories; hasAny = true; }
    if (ing.protein != null) pro += ing.protein;
    if (ing.fat != null) fat += ing.fat;
    if (ing.carbs != null) carbs += ing.carbs;
  }
  if (!hasAny) return null;
  return {
    calories: Math.round(cal / servings),
    protein:  Math.round(pro / servings),
    fat:      Math.round(fat / servings),
    carbs:    Math.round(carbs / servings),
  };
}

function totalTime(recipe) {
  let mins = 0;
  const parse = (s) => {
    if (!s) return 0;
    const h = s.match(/(\d+)\s*h/i);
    const m = s.match(/(\d+)\s*m/i);
    return (h ? parseInt(h[1]) * 60 : 0) + (m ? parseInt(m[1]) : 0);
  };
  mins = parse(recipe.prepTime) + parse(recipe.cookTime);
  return mins > 0 ? `${mins}m` : '?';
}

function keyIngredients(recipe) {
  return (recipe.ingredients || [])
    .filter(ing => ing.name && !ing.section)
    .slice(0, 6)
    .map(ing => ing.name.toLowerCase())
    .join(', ');
}

function buildRecipeDigest(recipes) {
  const lines = recipes.map(r => {
    const nut = calcNutritionPerServing(r);
    const calStr = nut ? `${nut.calories}cal` : '?';
    const proStr = nut ? `${nut.protein}g pro` : '?';
    const tags = (r.tags || []).join(', ') || 'none';
    return `${r.id} | ${r.name} | ${tags} | ${totalTime(r)} | ${calStr} | ${proStr} | ${keyIngredients(r)}`;
  });

  return `ID | Name | Tags | Total Time | Cal/srv | Pro/srv | Key Ingredients\n` + lines.join('\n');
}

// â”€â”€ System prompt â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const SYSTEM_PROMPT = `You are a meal planning assistant. Given a recipe catalog, weather forecast, seasonal produce info, and constraints, create a weekly meal plan.

Optimize for:
1. Nutritional balance â€” hit daily calorie and macro targets when provided
2. Variety â€” avoid repeating the same protein source on consecutive days; mix cuisines and cooking methods
3. Ingredient overlap â€” share perishable ingredients across meals in the same week to reduce grocery waste (e.g. if two recipes use cilantro, schedule them close together)
4. Time fit â€” respect per-day time constraints:
   - "quick" = under 30 min total prep+cook
   - "normal" = under 60 min (default)
   - "elaborate" = no time limit, can be a complex recipe
   - "none" = skip this day entirely (eating out, no cooking)
5. Practical flow â€” schedule batch-cook-friendly or crockpot meals earlier in the week when possible
6. Leftovers â€” when a recipe makes more servings than needed, suggest eating leftovers for a subsequent lunch or dinner instead of cooking a new meal. Mark leftover entries with plainText like "Leftovers: [Recipe Name]".
7. Complete meals â€” dinner entries should be full meals, not just a single dish. If a recipe is only a main (e.g. "Garlic Chicken"), add a plainText side dish or two to complement it (e.g. "Steamed broccoli and rice"). Use your judgment: a recipe like "Chicken Stir Fry with Rice" is already complete, but "Grilled Salmon" needs sides. Breakfasts and lunches can be standalone.
8. Weather awareness â€” when a weather forecast is provided, factor it in:
   - Hot days (85Â°F+): favor lighter meals, salads, no-cook options, grilling if not rainy
   - Rainy/stormy days: skip grilling, favor indoor cooking, comfort food is fine
   - Cold days: soups, stews, hearty meals are great choices
   - Nice mild weather: good grilling days
   These are soft preferences, not hard rules. Use common sense.
9. Seasonal produce â€” when seasonal produce info is provided, lean toward recipes that feature in-season ingredients. This is a soft preference for flavor and cost â€” never exclude a recipe just because it uses a pantry staple (onions, garlic, potatoes, canned goods) that isn't "in season." Seasonality applies to fresh produce highlights, not staples.

Rules:
- Only assign recipes from the provided catalog. Never invent recipes.
- Use the recipe ID exactly as given.
- For meals not in the catalog (like a simple breakfast, leftovers, or side dishes), use a plainText entry instead of a recipeId.
- If existing meals are already planned for certain slots, work around them.
- Consider the recent meal history to avoid repeating meals from the last 1-2 weeks.
- For days marked "none", do not plan any meals.
- Multiple entries per meal slot are fine (e.g. a recipe main + a plainText side for one dinner).

Return ONLY valid JSON matching this exact structure:
{
  "plan": [
    { "date": "YYYY-MM-DD", "meal": "Breakfast|Lunch|Dinner", "recipeId": "uuid-from-catalog", "reasoning": "1 sentence" }
  ],
  "shoppingNotes": "Brief notes about ingredient overlap opportunities",
  "nutritionSummary": { "avgDailyCalories": number, "avgDailyProtein": number }
}

For plain-text items (no recipe), use this format instead:
{ "date": "YYYY-MM-DD", "meal": "Breakfast", "plainText": "Oatmeal with berries", "reasoning": "Quick healthy breakfast" }`;

// â”€â”€ Weather forecast (Open-Meteo) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function fetchWeather(latitude, longitude, dates) {
  const startDate = dates[0];
  const endDate = dates[dates.length - 1];
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,weathercode&temperature_unit=fahrenheit&start_date=${startDate}&end_date=${endDate}&timezone=America%2FNew_York`;

  return new Promise((resolve) => {
    https.get(url, res => {
      let body = '';
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => {
        try {
          const data = JSON.parse(body);
          if (!data.daily) return resolve(null);
          const forecast = data.daily.time.map((date, i) => ({
            date,
            highF: Math.round(data.daily.temperature_2m_max[i]),
            lowF: Math.round(data.daily.temperature_2m_min[i]),
            precipMm: data.daily.precipitation_sum[i],
            code: data.daily.weathercode[i],
          }));
          resolve(forecast);
        } catch { resolve(null); }
      });
    }).on('error', () => resolve(null));
  });
}

const WMO_CONDITIONS = {
  0: 'Clear', 1: 'Mostly clear', 2: 'Partly cloudy', 3: 'Overcast',
  45: 'Fog', 48: 'Fog', 51: 'Light drizzle', 53: 'Drizzle', 55: 'Heavy drizzle',
  61: 'Light rain', 63: 'Rain', 65: 'Heavy rain', 66: 'Freezing rain', 67: 'Freezing rain',
  71: 'Light snow', 73: 'Snow', 75: 'Heavy snow', 80: 'Rain showers', 81: 'Rain showers',
  82: 'Heavy rain showers', 85: 'Snow showers', 86: 'Heavy snow showers',
  95: 'Thunderstorm', 96: 'Thunderstorm w/ hail', 99: 'Thunderstorm w/ hail',
};

function formatForecast(forecast) {
  return forecast.map(d => {
    const cond = WMO_CONDITIONS[d.code] || 'Unknown';
    const rain = d.precipMm > 0 ? `, ${d.precipMm}mm precip` : '';
    return `${d.date}: High ${d.highF}Â°F / Low ${d.lowF}Â°F, ${cond}${rain}`;
  }).join('\n');
}

// â”€â”€ Seasonal produce lookup â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const SEASONAL_PRODUCE = {
  1:  'citrus (oranges, grapefruit, lemons), kale, sweet potatoes, winter squash, cabbage, leeks, parsnips, turnips, beets, Brussels sprouts',
  2:  'citrus, kale, sweet potatoes, winter squash, cabbage, leeks, parsnips, turnips, beets',
  3:  'citrus, kale, spinach, lettuce, radishes, early peas, green onions, mushrooms',
  4:  'asparagus, peas, spinach, strawberries, radishes, artichokes, spring onions, lettuce, rhubarb, morel mushrooms',
  5:  'asparagus, strawberries, cherries, peas, spinach, lettuce, zucchini, snap peas, green beans, herbs (basil, cilantro, mint)',
  6:  'strawberries, blueberries, cherries, peaches, tomatoes, zucchini, corn, bell peppers, cucumbers, green beans, watermelon',
  7:  'tomatoes, corn, peaches, blueberries, blackberries, watermelon, zucchini, summer squash, bell peppers, cucumbers, eggplant, okra, green beans',
  8:  'tomatoes, corn, peaches, melons, figs, bell peppers, eggplant, okra, zucchini, summer squash, grapes, plums',
  9:  'apples, grapes, pears, figs, tomatoes, bell peppers, eggplant, winter squash (early), sweet potatoes, broccoli',
  10: 'apples, pears, pumpkin, winter squash, sweet potatoes, cranberries, Brussels sprouts, broccoli, cauliflower, kale',
  11: 'apples, pears, cranberries, winter squash, sweet potatoes, kale, Brussels sprouts, parsnips, turnips, pomegranate',
  12: 'citrus, kale, sweet potatoes, winter squash, pomegranate, cranberries, parsnips, turnips, Brussels sprouts, cabbage',
};

function getSeasonalProduce(dates) {
  const months = new Set(dates.map(d => parseInt(d.split('-')[1], 10)));
  const lines = [];
  for (const m of months) {
    const monthName = new Date(2024, m - 1, 1).toLocaleString('en-US', { month: 'long' });
    lines.push(`${monthName}: ${SEASONAL_PRODUCE[m]}`);
  }
  return lines.join('\n');
}

// â”€â”€ Generate action â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

async function handleGenerate(body) {
  const { groupId, week, dates: rawDates, preferences = {}, existingEntries = [], history = [], location } = body;
  if (!groupId) return respond(400, { error: 'Missing groupId' });
  if (!rawDates && !week) return respond(400, { error: 'Missing dates or week' });

  let recipes;
  try {
    recipes = await s3Get(`groups/${groupId}/recipes.json`);
  } catch {
    return respond(400, { error: 'Could not load recipes' });
  }

  if (!Array.isArray(recipes) || recipes.length === 0) {
    return respond(400, { error: 'No recipes found. Add some recipes first.' });
  }

  const digest = buildRecipeDigest(recipes);

  const {
    targetCalories,
    dietaryNotes,
    mealsToFill = ['Breakfast', 'Lunch', 'Dinner'],
    dayConstraints = {},
  } = preferences;

  // Build the dates to plan â€” either explicit array or expand from week Monday
  let dates;
  if (rawDates && Array.isArray(rawDates) && rawDates.length > 0) {
    dates = rawDates.sort();
    if (dates.length > 14) return respond(400, { error: 'Date range cannot exceed 14 days' });
  } else {
    const monday = new Date(week + 'T00:00:00');
    dates = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(d.getDate() + i);
      return d.toISOString().slice(0, 10);
    });
  }

  // Fetch weather forecast (non-blocking â€” don't fail the plan if weather is unavailable)
  let weatherText = null;
  if (location?.latitude && location?.longitude) {
    try {
      const forecast = await fetchWeather(location.latitude, location.longitude, dates);
      if (forecast) weatherText = formatForecast(forecast);
    } catch { /* weather is optional */ }
  }

  // Seasonal produce for the plan's months
  const seasonalText = getSeasonalProduce(dates);

  // Format dates with day names for the prompt
  const dateLine = dates.map(d => {
    const day = new Date(d + 'T00:00:00');
    return `${d} (${day.toLocaleDateString('en-US', { weekday: 'short' })})`;
  }).join(', ');

  let userPrompt = `## Recipe Catalog (${recipes.length} recipes)\n\n${digest}\n\n`;
  userPrompt += `## Dates to Plan\n${dateLine}\n\n`;
  userPrompt += `## Meals to Fill\n${mealsToFill.join(', ')}\n\n`;

  if (weatherText) {
    userPrompt += `## Weather Forecast\n${weatherText}\n\n`;
  }

  if (seasonalText) {
    userPrompt += `## Seasonal Produce (in season now)\n${seasonalText}\n\n`;
  }

  if (targetCalories) {
    userPrompt += `## Daily Nutrition Target\n~${targetCalories} calories/day\n\n`;
  }

  if (Object.keys(dayConstraints).length > 0) {
    userPrompt += `## Day Constraints\n`;
    for (const [date, constraint] of Object.entries(dayConstraints)) {
      userPrompt += `${date}: ${constraint}\n`;
    }
    userPrompt += '\n';
  }

  if (existingEntries.length > 0) {
    userPrompt += `## Already Planned (work around these)\n`;
    for (const e of existingEntries) {
      const label = e.plainText || recipes.find(r => r.id === e.recipeId)?.name || 'unknown';
      userPrompt += `${e.date} ${e.meal}: ${label}\n`;
    }
    userPrompt += '\n';
  }

  if (history.length > 0) {
    userPrompt += `## Recent History (avoid repeating)\n`;
    for (const e of history) {
      const label = e.plainText || recipes.find(r => r.id === e.recipeId)?.name || 'unknown';
      userPrompt += `${e.date} ${e.meal}: ${label}\n`;
    }
    userPrompt += '\n';
  }

  if (dietaryNotes) {
    userPrompt += `## User Notes\n${dietaryNotes}\n\n`;
  }

  userPrompt += `Generate the meal plan now.`;

  let response;
  try {
    response = await callClaude(SYSTEM_PROMPT, userPrompt);
  } catch (err) {
    return respond(500, { error: `AI generation failed: ${err.message}` });
  }

  // Parse JSON from response
  const jsonMatch = response.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return respond(500, { error: 'AI did not return valid JSON' });

  let result;
  try {
    result = JSON.parse(jsonMatch[0]);
  } catch {
    return respond(500, { error: 'AI response was not valid JSON' });
  }

  // Validate that all recipeIds exist in the catalog
  const recipeIds = new Set(recipes.map(r => r.id));
  if (result.plan) {
    result.plan = result.plan.filter(entry => {
      if (entry.plainText) return true;
      return entry.recipeId && recipeIds.has(entry.recipeId);
    });
  }

  return respond(200, result);
}

// â”€â”€ Refine action â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

async function handleRefine(body) {
  const { groupId, currentPlan, refinement } = body;
  if (!groupId) return respond(400, { error: 'Missing groupId' });
  if (!currentPlan) return respond(400, { error: 'Missing currentPlan' });
  if (!refinement) return respond(400, { error: 'Missing refinement text' });

  let recipes;
  try {
    recipes = await s3Get(`groups/${groupId}/recipes.json`);
  } catch {
    return respond(400, { error: 'Could not load recipes' });
  }

  const digest = buildRecipeDigest(recipes);

  const userPrompt = `## Recipe Catalog (${recipes.length} recipes)\n\n${digest}\n\n`
    + `## Current Plan\n${JSON.stringify(currentPlan, null, 2)}\n\n`
    + `## Refinement Request\n${refinement}\n\n`
    + `Apply the refinement to the current plan. Return the full updated plan in the same JSON format. Change only what's needed to address the request.`;

  let response;
  try {
    response = await callClaude(SYSTEM_PROMPT, userPrompt);
  } catch (err) {
    return respond(500, { error: `AI refinement failed: ${err.message}` });
  }

  const jsonMatch = response.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return respond(500, { error: 'AI did not return valid JSON' });

  let result;
  try {
    result = JSON.parse(jsonMatch[0]);
  } catch {
    return respond(500, { error: 'AI response was not valid JSON' });
  }

  // Validate recipeIds
  const recipeIds = new Set(recipes.map(r => r.id));
  if (result.plan) {
    result.plan = result.plan.filter(entry => {
      if (entry.plainText) return true;
      return entry.recipeId && recipeIds.has(entry.recipeId);
    });
  }

  return respond(200, result);
}

// â”€â”€ Main handler â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

// Group authz â€” caller must be in meal-planner-users
function requireGroup(event, group) {
  const claim = event.requestContext?.authorizer?.claims?.['cognito:groups'];
  const groups = Array.isArray(claim)
    ? claim
    : String(claim || '').replace(/^\[|\]$/g, '').split(/[\s,]+/).filter(Boolean);
  return groups.includes(group);
}

exports.handler = Sentry.wrapHandler(async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: CORS, body: '' };
  }

  if (!requireGroup(event, 'meal-planner-users')) {
    return { statusCode: 403, headers: CORS, body: JSON.stringify({ error: 'Forbidden: not a meal-planner-users group member' }) };
  }

  await getSecrets();

  const userId = event.requestContext?.authorizer?.claims?.['cognito:username'];
  if (!userId) return respond(401, { error: 'Unauthorized' });

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return respond(400, { error: 'Invalid JSON' }); }

  const { action } = body;

  if (action === 'generate') return handleGenerate(body);
  if (action === 'refine')   return handleRefine(body);

  return respond(400, { error: `Unknown action: ${action}` });
});
