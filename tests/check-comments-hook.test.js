import { describe, it, expect } from 'vitest';
import { spawnSync } from 'child_process';
import { mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const HOOK = join(__dirname, '../.claude/hooks/check-comments.sh');

function runHook(filePath) {
  const input = JSON.stringify({ tool_input: { file_path: filePath } });
  return spawnSync('bash', [HOOK], { input, encoding: 'utf8' });
}

function writeTmp(name, content) {
  const dir = mkdtempSync(join(tmpdir(), 'hook-comments-'));
  const filePath = join(dir, name);
  writeFileSync(filePath, content);
  return filePath;
}

describe('check-comments hook', () => {
  it('produces no output for a non-JS file', () => {
    const f = writeTmp('config.json', '{"key":"value"}\n');
    const r = runHook(f);
    expect(r.status).toBe(0);
    expect(r.stdout).toBe('');
  });

  it('produces no output for a JS file with zero inline comments', () => {
    const lines = Array.from({ length: 40 }, (_, i) => `const x${i} = ${i};`).join('\n');
    const f = writeTmp('util.js', lines + '\n');
    const r = runHook(f);
    expect(r.status).toBe(0);
    expect(r.stdout).toBe('');
  });

  it('produces no output for a long JS file with no section dividers', () => {
    const lines = Array.from({ length: 90 }, (_, i) => `const y${i} = ${i};`).join('\n');
    const f = writeTmp('big.js', lines + '\n');
    const r = runHook(f);
    expect(r.status).toBe(0);
    expect(r.stdout).toBe('');
  });

  it('warns when a JS file has unresolved TODOs', () => {
    const f = writeTmp('work.js', 'const x = 1; // TODO: fix this\n');
    const r = runHook(f);
    expect(r.status).toBe(0);
    expect(r.stdout).toContain('TODO');
  });

  it('warns when a Lambda file is missing a header block', () => {
    const dir = mkdtempSync(join(tmpdir(), 'hook-comments-lambda-'));
    const lambdaDir = join(dir, 'lambda');
    spawnSync('mkdir', ['-p', lambdaDir]);
    const filePath = join(lambdaDir, 'handler.js');
    writeFileSync(filePath, 'exports.handler = async () => ({ statusCode: 200 });\n');
    const r = runHook(filePath);
    expect(r.status).toBe(0);
    expect(r.stdout).toContain('missing a header block');
  });

  it('produces no output for a Lambda file with a proper header', () => {
    const dir = mkdtempSync(join(tmpdir(), 'hook-comments-lambda-'));
    const lambdaDir = join(dir, 'lambda');
    spawnSync('mkdir', ['-p', lambdaDir]);
    const filePath = join(lambdaDir, 'save.js');
    const content = [
      '// Lambda: MealPlannerSave',
      '// Route: POST /save',
      '// Auth: Cognito authorizer',
      '// Environment variables: ANTHROPIC_API_KEY',
      'exports.handler = async () => ({ statusCode: 200 });',
    ].join('\n') + '\n';
    writeFileSync(filePath, content);
    const r = runHook(filePath);
    expect(r.status).toBe(0);
    expect(r.stdout).toBe('');
  });
});
