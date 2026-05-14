import { defineConfig } from 'vitest/config';

// Vitest configuration per platform ADR-0004 — tiered coverage thresholds.
// The project's existing tests live at tests/*.test.js and use happy-dom.
// Default behavior preserves what the project already has.

export default defineConfig({
  test: {
    environment: 'happy-dom',
    globals: true,
    include: ['tests/**/*.{test,spec}.{js,mjs}', 'src/**/*.{test,spec}.{js,mjs}'],
    exclude: [
      'node_modules/**',
      '.claude/worktrees/**',
      'lambda/node_modules/**',
      'mcp/node_modules/**',
      'tests/e2e/**',   // Playwright owns these; vitest can't run them
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json', 'lcov'],
      include: ['src/**/*.js', 'lambda/**/*.{js,mjs}'],
      exclude: [
        'src/**/*.test.js',
        'lambda/**/*.test.js',
        'lambda/node_modules/**',
        'lambda/iam/**',
        'mcp/**',
        'public/**',
      ],
      thresholds: {
        // Default tier per ADR-0004 — applies to all not in critical/utility
        global: { lines: 80, branches: 70 },
        // Critical paths (90/80) — auth, authz, data integrity
        'src/js/auth/**': { lines: 90, branches: 80 },
        'lambda/apiKeyAuthorizer.js': { lines: 90, branches: 80 },
        'lambda/nudge.js': { lines: 85, branches: 75 }, // sends real email
        // Utility tier (60/50)
        'src/js/utils/**': { lines: 60, branches: 50 },
        'src/js/ui/**': { lines: 60, branches: 50 },
      },
    },
  },
});
