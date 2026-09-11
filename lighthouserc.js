module.exports = {
  ci: {
    collect: {
      staticDistDir: './.next',
      url: [
        'http://localhost:3000',
        'http://localhost:3000/admin',
        'http://localhost:3000/admin/solicitudes',
        'http://localhost:3000/admin/productos',
      ],
      numberOfRuns: 3,
      settings: {
        preset: 'desktop',
      },
    },
    assert: {
      assertions: {
        'categories:performance': ['error', { min: 0.8 }],
        'categories:accessibility': ['error', { min: 0.9 }],
        'categories:best-practices': ['error', { min: 0.9 }],
        'categories:seo': ['error', { min: 0.8 }],
        'first-contentful-paint': ['error', { maxNumericValue: 1800 }],
        'largest-contentful-paint': ['error', { maxNumericValue: 2500 }],
        'cumulative-layout-shift': ['error', { maxNumericValue: 0.1 }],
        'total-blocking-time': ['error', { maxNumericValue: 300 }],
      },
    },
    upload: {
      target: 'filesystem',
      outputDir: './lighthouse-reports',
    },
    server: {
      port: 3000,
    },
  },
};
