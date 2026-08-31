import tsParser from '@typescript-eslint/parser';
import reactHooks from 'eslint-plugin-react-hooks';
import { FlatCompat } from '@eslint/eslintrc';

const compat = new FlatCompat({ baseDirectory: import.meta.dirname });

export default [
  { ignores: ['.next/**', '.next-dev/**', 'node_modules/**'] },
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: { ecmaVersion: 'latest', sourceType: 'module', ecmaFeatures: { jsx: true } },
    },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-hooks/exhaustive-deps': 'off',
      'no-undef': 'off',
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      // Public signed media and operator-provided remote images do not have a
      // finite host allow-list, so these specific surfaces intentionally use img.
      '@next/next/no-img-element': 'off',
    },
  },
  {
    files: ['src/**/*.spec.{ts,tsx}'],
    rules: { 'jsx-a11y/alt-text': 'off' },
  },
  {
    files: ['src/test/**/*.cjs'],
    rules: { '@typescript-eslint/no-require-imports': 'off' },
  },
];
