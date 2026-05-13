// ESLint flat config per platform ADR-0005 — pragmatic strict, JS variant.
// Targets src/ (frontend, ESM) and lambda/ (backend, CommonJS).
// Note: this project does NOT use TypeScript; we skip typescript-eslint plugins.

import js from '@eslint/js';
import importPlugin from 'eslint-plugin-import';
import unusedImports from 'eslint-plugin-unused-imports';
import promise from 'eslint-plugin-promise';
import globals from 'globals';

export default [
  {
    ignores: [
      'node_modules/',
      'dist/',
      'build/', // generated Lambda zip staging dirs — not source
      'site/',
      'coverage/',
      'lambda/node_modules/',
      'mcp/node_modules/',
      '.claude/worktrees/',
      'public/',
    ],
  },
  js.configs.recommended,
  {
    files: ['src/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.browser, ...globals.es2022 },
    },
    plugins: {
      import: importPlugin,
      'unused-imports': unusedImports,
      promise,
    },
    rules: {
      'unused-imports/no-unused-imports': 'error',
      'import/order': [
        'error',
        {
          groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
          'newlines-between': 'always',
        },
      ],
      'promise/always-return': 'error',
      'promise/no-nesting': 'warn',
      complexity: ['warn', 10],
      'max-lines-per-function': ['warn', { max: 50, skipBlankLines: true, skipComments: true }],
      'no-console': 'warn',
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    },
  },
  {
    files: ['lambda/**/*.js', 'lambda/**/*.mjs'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
      globals: { ...globals.node, ...globals.es2022 },
    },
    plugins: { promise },
    rules: {
      'promise/always-return': 'error',
      'no-console': 'off', // CloudWatch logs use console.log
      complexity: ['warn', 10],
      'max-lines-per-function': ['warn', { max: 60, skipBlankLines: true, skipComments: true }],
    },
  },
  {
    files: ['mcp/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
      globals: { ...globals.node, ...globals.es2022 },
    },
    rules: {
      'no-console': 'off',
    },
  },
  {
    files: ['tests/**/*.test.js', 'tests/**/*.spec.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.node, ...globals.browser, ...globals.es2022 },
    },
    rules: {
      'no-console': 'off',
      'max-lines-per-function': 'off',
    },
  },
  {
    // Root-level config files (vite.config.js, vitest.config.js, etc.) run in
    // a Node ESM context. Without this block they fall under the default
    // recommended config and miss `URL`, `process`, `import.meta`, etc.
    files: ['*.config.js', '*.config.mjs'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.node, ...globals.es2022 },
    },
  },
];
