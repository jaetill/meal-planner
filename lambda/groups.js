const { S3Client, GetObjectCommand, PutObjectCommand } = require('@aws-sdk/client-s3');

const BUCKET          = 'jaetill-meal-planner';
const s3              = new S3Client({ region: 'us-east-2' });
const ALLOWED_ORIGINS = new Set(['https://meals.jaetill.com', 'http://localhost:5173']);

// Default CORS used by individual handlers (origin override applied by main handler)
const CORS = {
  'Access-Control-Allow-Origin':  'https://meals.jaetill.com',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Content-Type': 'application/json',
};

function corsHeaders(event) {
  const origin = event.headers?.origin || event.headers?.Origin || '';
  return { ...CORS, 'Access-Control-Allow-Origin': ALLOWED_ORIGINS.has(origin) ? origin : CORS['Access-Control-Allow-Origin'] };
}

// ── S3 helpers ────────────────────────────────────────────

async function s3Get(key) {
  try {
    const res = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
    const body = await res.Body.transformToString();
    return JSON.parse(body);
  } catch (err) {
    if (err.name === 'NoSuchKey') return null;
    throw err;
  }
}

async function s3Put(key, data) {
  await s3.send(new PutObjectCommand({
    Bucket: BUCKET, Key: key,
    Body: JSON.stringify(data),
    ContentType: 'application/json',
    CacheControl: 'no-cache, no-store, must-revalidate',
  }));
}

// ── Group helpers ─────────────────────────────────────────

async function getUserGroups(userId) {
  return (await s3Get(`users/${userId}/groups.json`)) || [];
}

async function saveUserGroups(userId, groups) {
  await s3Put(`users/${userId}/groups.json`, groups);
}

async function getGroupInfo(groupId) {
  return s3Get(`groups/${groupId}/info.json`);
}

async function saveGroupInfo(groupId, info) {
  await s3Put(`groups/${groupId}/info.json`, info);
}

function generateCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase(); // e.g. "K7M2XP"
}

// ── Route handlers ────────────────────────────────────────

// GET /groups — list the calling user's groups
async function handleList(userId) {
  const groups = await getUserGroups(userId);
  return { statusCode: 200, headers: CORS, body: JSON.stringify({ groups }) };
}

// POST /groups { action: 'create', name }
async function handleCreate(userId, body) {
  const { name } = body;
  if (!name?.trim()) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'name required' }) };

  const groupId = crypto.randomUUID();
  const now     = Date.now();

  const info = {
    groupId,
    name: name.trim(),
    ownerId: userId,
    createdAt: now,
    members: [{ userId, role: 'owner', joinedAt: now }],
    inviteCodes: [],
  };

  await saveGroupInfo(groupId, info);
  await s3Put(`groups/${groupId}/recipes.json`, []);
  await s3Put(`groups/${groupId}/meal-plans.json`, []);

  const userGroups = await getUserGroups(userId);
  userGroups.push({ groupId, name: info.name, role: 'owner' });
  await saveUserGroups(userId, userGroups);

  return { statusCode: 200, headers: CORS, body: JSON.stringify({ group: { groupId, name: info.name, role: 'owner' } }) };
}

// POST /groups { action: 'invite', groupId }
async function handleInvite(userId, body) {
  const { groupId } = body;
  if (!groupId) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'groupId required' }) };

  const info = await getGroupInfo(groupId);
  if (!info) return { statusCode: 404, headers: CORS, body: JSON.stringify({ error: 'Group not found' }) };

  const isMember = info.members.some(m => m.userId === userId);
  if (!isMember) return { statusCode: 403, headers: CORS, body: JSON.stringify({ error: 'Not a member' }) };

  // Prune expired codes
  const now = Date.now();
  info.inviteCodes = (info.inviteCodes || []).filter(c => c.expiresAt > now);

  const code      = generateCode();
  const expiresAt = now + 7 * 24 * 60 * 60 * 1000; // 7 days
  info.inviteCodes.push({ code, createdBy: userId, expiresAt });
  await saveGroupInfo(groupId, info);
  await s3Put(`codes/${code}.json`, { groupId, createdBy: userId, expiresAt });

  return { statusCode: 200, headers: CORS, body: JSON.stringify({ code, expiresAt }) };
}

// POST /groups { action: 'join', code }
async function handleJoin(userId, body) {
  const { code } = body;
  if (!code) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'code required' }) };

  // Search all user groups for this code — but we don't have a code→group index.
  // Store a code index at codes/{code}.json pointing to groupId.
  const codeData = await s3Get(`codes/${code}.json`);
  if (!codeData) return { statusCode: 404, headers: CORS, body: JSON.stringify({ error: 'Invalid or expired invite code' }) };

  if (codeData.expiresAt < Date.now())
    return { statusCode: 410, headers: CORS, body: JSON.stringify({ error: 'Invite code has expired' }) };

  const { groupId } = codeData;
  const info = await getGroupInfo(groupId);
  if (!info) return { statusCode: 404, headers: CORS, body: JSON.stringify({ error: 'Group not found' }) };

  if (info.members.some(m => m.userId === userId))
    return { statusCode: 200, headers: CORS, body: JSON.stringify({ group: { groupId, name: info.name, role: 'member' } }) };

  info.members.push({ userId, role: 'member', joinedAt: Date.now() });
  await saveGroupInfo(groupId, info);

  const userGroups = await getUserGroups(userId);
  userGroups.push({ groupId, name: info.name, role: 'member' });
  await saveUserGroups(userId, userGroups);

  return { statusCode: 200, headers: CORS, body: JSON.stringify({ group: { groupId, name: info.name, role: 'member' } }) };
}

// GET /groups?action=members&groupId=...
async function handleMembers(userId, groupId) {
  if (!groupId) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'groupId required' }) };

  const info = await getGroupInfo(groupId);
  if (!info) return { statusCode: 404, headers: CORS, body: JSON.stringify({ error: 'Group not found' }) };

  const isMember = info.members.some(m => m.userId === userId);
  if (!isMember) return { statusCode: 403, headers: CORS, body: JSON.stringify({ error: 'Not a member' }) };

  return { statusCode: 200, headers: CORS, body: JSON.stringify({ members: info.members, name: info.name }) };
}

// POST /groups { action: 'share', targetUsername, recipe }
async function handleShare(userId, body) {
  const { targetUsername, recipe } = body;
  if (!targetUsername || !recipe?.name) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'targetUsername and recipe required' }) };
  }

  const indexKey = `incoming/${targetUsername}/index.json`;
  const index = (await s3Get(indexKey)) || [];

  const share = {
    shareId:      crypto.randomUUID(),
    recipe,
    fromUsername: userId,
    sharedAt:     Date.now(),
  };

  index.push(share);
  await s3Put(indexKey, index);

  return { statusCode: 200, headers: CORS, body: JSON.stringify({ shareId: share.shareId }) };
}

// GET /groups?action=incoming
async function handleIncoming(userId) {
  const shares = (await s3Get(`incoming/${userId}/index.json`)) || [];
  return { statusCode: 200, headers: CORS, body: JSON.stringify({ shares }) };
}

// POST /groups { action: 'acceptShare', shareId, groupId }
async function handleAcceptShare(userId, body) {
  const { shareId, groupId } = body;
  if (!shareId || !groupId) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'shareId and groupId required' }) };
  }

  const userGroups = await getUserGroups(userId);
  if (!userGroups.some(g => g.groupId === groupId)) {
    return { statusCode: 403, headers: CORS, body: JSON.stringify({ error: 'Not a member of that group' }) };
  }

  const indexKey = `incoming/${userId}/index.json`;
  const index = (await s3Get(indexKey)) || [];
  const share = index.find(s => s.shareId === shareId);
  if (!share) {
    return { statusCode: 404, headers: CORS, body: JSON.stringify({ error: 'Share not found' }) };
  }

  const groupRecipes = (await s3Get(`groups/${groupId}/recipes.json`)) || [];
  const newRecipe = {
    ...share.recipe,
    id:        crypto.randomUUID(),
    createdAt: Date.now(),
  };
  groupRecipes.push(newRecipe);
  await s3Put(`groups/${groupId}/recipes.json`, groupRecipes);

  const updatedIndex = index.filter(s => s.shareId !== shareId);
  await s3Put(indexKey, updatedIndex);

  return { statusCode: 200, headers: CORS, body: JSON.stringify({ recipe: newRecipe }) };
}

// POST /groups { action: 'dismissShare', shareId }
async function handleDismissShare(userId, body) {
  const { shareId } = body;
  if (!shareId) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'shareId required' }) };
  }

  const indexKey = `incoming/${userId}/index.json`;
  const index = (await s3Get(indexKey)) || [];
  const updatedIndex = index.filter(s => s.shareId !== shareId);
  await s3Put(indexKey, updatedIndex);

  return { statusCode: 200, headers: CORS, body: JSON.stringify({ dismissed: shareId }) };
}

// ── Main handler ──────────────────────────────────────────

exports.handler = async (event) => {
  const CORS = corsHeaders(event);

  if (event.httpMethod === 'OPTIONS')
    return { statusCode: 200, headers: CORS, body: '' };

  const userId = event.requestContext?.authorizer?.claims?.['cognito:username'];
  if (!userId) return { statusCode: 401, headers: CORS, body: JSON.stringify({ error: 'Unauthorized' }) };

  try {
    let result;

    if (event.httpMethod === 'GET') {
      const action  = event.queryStringParameters?.action;
      const groupId = event.queryStringParameters?.groupId;
      if (action === 'members')       result = await handleMembers(userId, groupId);
      else if (action === 'incoming') result = await handleIncoming(userId);
      else                            result = await handleList(userId);
    } else if (event.httpMethod === 'POST') {
      let body;
      try { body = JSON.parse(event.body || '{}'); }
      catch { return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Invalid JSON' }) }; }

      const { action } = body;
      if (action === 'create')             result = await handleCreate(userId, body);
      else if (action === 'invite')        result = await handleInvite(userId, body);
      else if (action === 'join')          result = await handleJoin(userId, body);
      else if (action === 'share')         result = await handleShare(userId, body);
      else if (action === 'acceptShare')   result = await handleAcceptShare(userId, body);
      else if (action === 'dismissShare')  result = await handleDismissShare(userId, body);
      else return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Unknown action' }) };
    } else {
      return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Method not allowed' }) };
    }

    // Stamp correct CORS headers on whatever the handler returned
    return { ...result, headers: { ...result.headers, ...CORS } };
  } catch (err) {
    console.error(err);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: err.message }) };
  }
};
