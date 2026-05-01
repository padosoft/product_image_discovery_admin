import { defineConfig } from 'vite';
import laravel from 'laravel-vite-plugin';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [
    laravel({
      input: [
        'resources/css/admin-product-image-discovery.css',
        'resources/js/admin-product-image-discovery/main.jsx',
      ],
      refresh: true,
    }),
    react(),
  ],
  test: {
    environment: 'jsdom',
    globals: true,
    pool: 'threads',
    include: ['tests/JavaScript/**/*.test.jsx', 'tests/JavaScript/**/*.test.js'],
  },
});
