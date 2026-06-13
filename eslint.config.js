const tsParser = require('@typescript-eslint/parser');
const unusedImports = require('eslint-plugin-unused-imports');
const tsPlugin = require('@typescript-eslint/eslint-plugin');

const configs = [
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsParser,
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
      'unused-imports': unusedImports,
    },
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
      'unused-imports/no-unused-imports': 'warn',
      'unused-imports/no-unused-vars': ['warn', {
        vars: 'all',
        varsIgnorePattern: '^_',
        args: 'after-used',
        argsIgnorePattern: '^_',
        ignoreRestSiblings: true,
      }],
    },
  },
  {
    ignores: [
      '.next/*',
      'node_modules/*',
      'scripts/*',
      'backups/*',
      'public/sw.js',
    ],
  },
];

module.exports = configs;