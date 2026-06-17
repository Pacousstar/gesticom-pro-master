const fs = require('fs')
const path = require('path')

const withBundleAnalyzer = process.env.ANALYZE === 'true'
  ? require('@next/bundle-analyzer')()
  : (config) => config

/** @type {import('next').NextConfig} */
const pkgVersion = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8')).version

const csp = [
  `default-src 'self'`,
  `script-src 'self' 'unsafe-eval' 'unsafe-inline' https://*.gsnexpertises.com`,
  `style-src 'self' 'unsafe-inline'`,
  `img-src 'self' data: blob: https://*.gsnexpertises.com`,
  `font-src 'self' data:`,
  `connect-src 'self' https://*.gsnexpertises.com`,
  `frame-ancestors 'none'`,
  `base-uri 'self'`,
  `form-action 'self'`,
].join('; ')

const nextConfig = {
  output: 'standalone',
  allowedDevOrigins: ['10.100.239.92', '10.78.185.92', 'localhost'],
  env: {
    NEXT_PUBLIC_APP_VERSION: pkgVersion,
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'Content-Security-Policy', value: csp },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          { key: 'X-DNS-Prefetch-Control', value: 'on' },
        ],
      },
    ]
  },
  outputFileTracingIncludes: {
    '/api/**': ['./node_modules/jspdf/**/*'],
  },
  outputFileTracingExcludes: {
    '*': [
      '**/lib/sauvegarde-db*',
      '**/api/sauvegarde/**/*',
      '**/*.disabled',
      'e2e/**',
    ],
  },
}

module.exports = withBundleAnalyzer(nextConfig)
