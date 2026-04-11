/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  outputFileTracingExcludes: {
    '*': [
      '**/api/sauvegarde/**/*',
      '**/backups/**/*',
    ],
  },
};

module.exports = nextConfig;
