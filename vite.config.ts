import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

// Version stamp, e.g. 20261127-1130. Newer versions sort later.
const BUILD = process.env.BUILD_ID ?? new Date().toISOString().slice(0, 16).replace(/[-:]/g, '').replace('T', '-');

// Builds everything (code, styles, course data) into ONE html file.
export default defineConfig({
  plugins: [
    react(),
    viteSingleFile(),
    {
      name: 'build-stamp',
      transformIndexHtml: html => html.replace('<head>', `<head>\n    <meta name="guitar-coach-build" content="${BUILD}" />`),
    },
  ],
  define: { __BUILD__: JSON.stringify(BUILD) },
  base: './',
  build: { outDir: 'dist', assetsInlineLimit: 100_000_000 },
  test: { globals: true, environment: 'node', testTimeout: 30000 },
});
