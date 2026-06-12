import { describe, it, expect } from 'vitest';
import { spawnSync } from 'child_process';
import { mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const HOOK = join(__dirname, '../.claude/hooks/check-secrets.sh');
const COMMIT_INPUT = JSON.stringify({ tool_input: { command: 'git commit -m "test"' } });

// Split across runtime concat so the source literals don't trigger check-secrets
// when this file is staged. The staged test-file content still matches the hook.
const VAR_NAME = 'API' + '_KEY';
const KROGER_VAR = 'kroger' + '_client';
const USDA_VAR = 'usda' + '_key';
const LONG_VAL = 'abcdefghijklmnopqrstuvwxyz1234'; // 30 chars, clearly not a real secret

function setupRepo() {
  const dir = mkdtempSync(join(tmpdir(), 'hook-test-'));
  spawnSync('bash', ['-c', 'git init && git config user.email t@t.com && git config user.name T'], { cwd: dir });
  return dir;
}

function stageFile(dir, name, content) {
  writeFileSync(join(dir, name), content);
  spawnSync('git', ['add', name], { cwd: dir });
}

function runHook(dir) {
  return spawnSync('bash', [HOOK], { input: COMMIT_INPUT, cwd: dir, encoding: 'utf8' });
}

describe('check-secrets hook', () => {
  it('blocks a double-quoted credential value', () => {
    const dir = setupRepo();
    stageFile(dir, 'config.js', `const ${VAR_NAME} = "${LONG_VAL}";\n`);
    const r = runHook(dir);
    expect(r.status).toBe(2);
    expect(r.stderr).toContain('BLOCKED');
  });

  it('blocks a single-quoted credential value', () => {
    const dir = setupRepo();
    stageFile(dir, 'config.js', `const ${VAR_NAME} = '${LONG_VAL}';\n`);
    const r = runHook(dir);
    expect(r.status).toBe(2);
    expect(r.stderr).toContain('BLOCKED');
  });

  it('blocks a single-quoted Kroger credential', () => {
    const dir = setupRepo();
    stageFile(dir, 'config.js', `const ${KROGER_VAR} = '${LONG_VAL}';\n`);
    const r = runHook(dir);
    expect(r.status).toBe(2);
    expect(r.stderr).toContain('BLOCKED');
  });

  it('blocks a single-quoted USDA key', () => {
    const dir = setupRepo();
    stageFile(dir, 'config.js', `const ${USDA_VAR} = '${LONG_VAL}';\n`);
    const r = runHook(dir);
    expect(r.status).toBe(2);
    expect(r.stderr).toContain('BLOCKED');
  });

  it('passes a file with no hardcoded secrets', () => {
    const dir = setupRepo();
    stageFile(dir, 'config.js', 'const API_KEY = process.env.ANTHROPIC_API_KEY;\n');
    const r = runHook(dir);
    expect(r.status).toBe(0);
  });
});
