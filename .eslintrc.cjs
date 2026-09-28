/* eslint-env node */
module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: { ecmaVersion: 2021, sourceType: 'module', ecmaFeatures: { jsx: true } },
  plugins: ['@typescript-eslint'],
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended'],
  env: { es2021: true },
  ignorePatterns: ['dist', 'node_modules', 'example', '*.cjs'],
  rules: {
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/consistent-type-imports': 'error',
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    // Every log line in this package goes through src/log.ts, which is what applies
    // redaction. A stray console.* elsewhere would bypass it.
    'no-console': 'error',
  },
  overrides: [
    { files: ['src/log.ts'], rules: { 'no-console': 'off' } },
    { files: ['test/**/*.ts', 'test/**/*.tsx'], env: { node: true } },
  ],
}
