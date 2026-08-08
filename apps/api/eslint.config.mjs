import tsParser from '@typescript-eslint/parser';

/**
 * The API had no ESLint config and no `lint` script at all until Phase 3 of the
 * audit. The root `lint` runs `--workspaces --if-present`, so all 191 API
 * TypeScript files were silently skipped and a green "lint" only ever meant the
 * web app had passed (STR-201).
 *
 * The ruleset is deliberately small: enabling a recommended preset across a
 * codebase this size would produce a large diff unrelated to any finding, which
 * the audit's ground rules forbid. Its job for now is to exist, to be wired into
 * the gate, and to be tightened deliberately later.
 *
 * Module-boundary enforcement lives in `src/architecture.spec.ts`, not here.
 * ESLint 9's `no-restricted-imports` does not apply `patterns[].group` globs
 * with minimatch semantics, so a pattern that provably matches the offending
 * path under minimatch still reported nothing — and a lint rule that silently
 * passes is worse than no rule, because it reads as proof.
 */
export default [
  { ignores: ['dist/**', 'node_modules/**', 'prisma/**'] },
  {
    files: ['src/**/*.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: { ecmaVersion: 'latest', sourceType: 'module' },
    },
    rules: {
      'no-undef': 'off',
      'no-unused-vars': 'off',
    },
  },
];
