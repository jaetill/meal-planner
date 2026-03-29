/**
 * One-time migration: fetch recipe photos from external URLs, store in S3,
 * update recipes.json with CloudFront URLs (or null if fetch fails).
 *
 * Run with: node tools/migrate-photos.js
 * Requires AWS credentials for jaetill-dev (us-east-2).
 */

const { S3Client, GetObjectCommand, PutObjectCommand } = require('@aws-sdk/client-s3');
const https = require('https');

const BUCKET   = 'jaetill-meal-planner';
const CF_BASE  = 'https://meals.jaetill.com';
const s3       = new S3Client({ region: 'us-east-2' });

async function s3Get(key) {
  const res  = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
  const body = await res.Body.transformToString();
  return JSON.parse(body);
}

async function s3Put(key, data, contentType = 'application/json') {
  const body = contentType === 'application/json' ? JSON.stringify(data) : data;
  await s3.send(new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: body, ContentType: contentType }));
}

function fetchImageBuffer(url, redirects = 0) {
  return new Promise((resolve, reject) => {
    if (redirects > 5) return reject(new Error('Too many redirects'));
    try {
      const req = https.get(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MealPlannerBot/1.0)' },
        timeout: 10000,
      }, res => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          return fetchImageBuffer(res.headers.location, redirects + 1).then(resolve).catch(reject);
        }
        if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`));
        const contentType = res.headers['content-type']?.split(';')[0] || 'image/jpeg';
        if (!contentType.startsWith('image/')) return reject(new Error(`Not an image: ${contentType}`));
        const chunks = [];
        res.on('data', chunk => chunks.push(chunk));
        res.on('end', () => resolve({ buffer: Buffer.concat(chunks), contentType }));
      });
      req.on('error', reject);
      req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
    } catch (err) {
      reject(err);
    }
  });
}

async function migratePhoto(recipe) {
  const { id, photo } = recipe;

  // Already local or no photo — skip
  if (!photo || photo.startsWith(CF_BASE)) return photo;

  try {
    const { buffer, contentType } = await fetchImageBuffer(photo);
    await s3Put(`photos/${id}`, buffer, contentType);
    const newUrl = `${CF_BASE}/photos/${id}`;
    console.log(`  ✓ ${recipe.name.slice(0, 50)}`);
    return newUrl;
  } catch (err) {
    console.log(`  ✗ ${recipe.name.slice(0, 50)} — ${err.message}`);
    return null;
  }
}

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function run() {
  console.log('Loading recipes.json...');
  const recipes = await s3Get('recipes.json');
  const toMigrate = recipes.filter(r => r.photo && !r.photo.startsWith(CF_BASE));
  console.log(`${recipes.length} recipes total, ${toMigrate.length} with external photos to migrate.\n`);

  let updated = 0, cleared = 0;
  const BATCH = 5;

  for (let i = 0; i < recipes.length; i++) {
    const recipe = recipes[i];
    if (!recipe.photo || recipe.photo.startsWith(CF_BASE)) continue;

    const newUrl = await migratePhoto(recipe);
    recipes[i] = { ...recipe, photo: newUrl };
    if (newUrl) updated++; else cleared++;

    // Rate-limit: pause between batches
    if ((updated + cleared) % BATCH === 0) await sleep(500);
  }

  console.log(`\nDone. ${updated} photos stored, ${cleared} cleared (dead URLs).`);
  console.log('Saving updated recipes.json...');
  await s3Put('recipes.json', recipes);
  console.log('Complete.');
}

run().catch(err => { console.error(err); process.exit(1); });
