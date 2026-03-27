const { S3Client, GetObjectCommand, PutObjectCommand } = require('@aws-sdk/client-s3');

const BUCKET          = 'jaetill-meal-planner';
const s3              = new S3Client({ region: 'us-east-2' });
const ALLOWED_ORIGINS = new Set(['https://meals.jaetill.com', 'http://localhost:5173']);

function corsHeaders(event) {
  const origin = event.headers?.origin || event.headers?.Origin || '';
  return {
    'Access-Control-Allow-Origin':  ALLOWED_ORIGINS.has(origin) ? origin : 'https://meals.jaetill.com',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    'Content-Type': 'application/json',
  };
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
      result = action === 'members'
        ? await handleMembers(userId, groupId)
        : await handleList(userId);
    } else if (event.httpMethod === 'POST') {
      let body;
      try { body = JSON.parse(event.body || '{}'); }
      catch { return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Invalid JSON' }) }; }

      const { action } = body;
      if (action === 'create')      result = await handleCreate(userId, body);
      else if (action === 'invite') result = await handleInvite(userId, body);
      else if (action === 'join')   result = await handleJoin(userId, body);
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
