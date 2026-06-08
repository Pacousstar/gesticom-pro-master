const { FlatCompat } = require('@eslint/eslintrc');
const path = require('path');

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const configs = [
  ...compat.config({
    extends: ['next/core-web-vitals'],
    rules: {
      '@next/next/no-img-element': 'off',
    },
  }),
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
