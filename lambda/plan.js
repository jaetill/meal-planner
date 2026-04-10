// Lambda: meal-planner-plan — AI-assisted meal plan generation
//   POST /plan — generate or refine a weekly meal plan using Claude
//
// Auth: Cognito authorizer — userId from event.requestContext.authorizer.claims['cognito:username']
// Environment variables: ANTHROPIC_API_KEY
// S3 paths read: groups/{groupId}/recipes.json

'use strict';

const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
const https = require('https');

const BUCKET = 'jaetill-meal-planner';
const s3     = new S3Client({ region: 'us-east-2' });

const CORS = {
  'Access-Control-Allow-Origin':  'https://meals.jaetill.com',
  'Access-Control-Allow-Methods': 'POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Content-Type': 'application/json',
};

// ── Helpers ──────────────────────────────────────────────────

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
        'x-api-key':         process.env.ANTHROPIC_API_KEY,
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

// ── Recipe digest builder ────────────────────────────────────

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

// ── System prompt ────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a meal planning assistant. Given a recipe catalog and constraints, create a weekly meal plan.

Optimize for:
1. Nutritional balance — hit daily calorie and macro targets when provided
2. Variety — avoid repeating the same protein source on consecutive days; mix cuisines and cooking methods
3. Ingredient overlap — share perishable ingredients across meals in the same week to reduce grocery waste (e.g. if two recipes use cilantro, schedule them close together)
4. Time fit — respect per-day time constraints:
   - "quick" = under 30 min total prep+cook
   - "normal" = under 60 min (default)
   - "elaborate" = no time limit, can be a complex recipe
   - "none" = skip this day entirely (eating out, no cooking)
5. Practical flow — schedule batch-cook-friendly or crockpot meals earlier in the week when possible
6. Leftovers — when a recipe makes more servings than needed, suggest eating leftovers for a subsequent lunch or dinner instead of cooking a new meal. Mark leftover entries with plainText like "Leftovers: [Recipe Name]".

Rules:
- Only assign recipes from the provided catalog. Never invent recipes.
- Use the recipe ID exactly as given.
- For meals not in the catalog (like a simple breakfast or leftovers), use a plainText entry instead of a recipeId.
- If existing meals are already planned for certain slots, work around them.
- Consider the recent meal history to avoid repeating meals from the last 1-2 weeks.
- For days marked "none", do not plan any meals.

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

// ── Generate action ──────────────────────────────────────────

async function handleGenerate(body) {
  const { groupId, week, dates: rawDates, preferences = {}, existingEntries = [], history = [] } = body;
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

  // Build the dates to plan — either explicit array or expand from week Monday
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

  // Format dates with day names for the prompt
  const dateLine = dates.map(d => {
    const day = new Date(d + 'T00:00:00');
    return `${d} (${day.toLocaleDateString('en-US', { weekday: 'short' })})`;
  }).join(', ');

  let userPrompt = `## Recipe Catalog (${recipes.length} recipes)\n\n${digest}\n\n`;
  userPrompt += `## Dates to Plan\n${dateLine}\n\n`;
  userPrompt += `## Meals to Fill\n${mealsToFill.join(', ')}\n\n`;

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

// ── Refine action ────────────────────────────────────────────

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

// ── Main handler ─────────────────────────────────────────────

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: CORS, body: '' };
  }

  const userId = event.requestContext?.authorizer?.claims?.['cognito:username'];
  if (!userId) return respond(401, { error: 'Unauthorized' });

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return respond(400, { error: 'Invalid JSON' }); }

  const { action } = body;

  if (action === 'generate') return handleGenerate(body);
  if (action === 'refine')   return handleRefine(body);

  return respond(400, { error: `Unknown action: ${action}` });
};
