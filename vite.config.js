import { defineConfig } from 'vite';

export default defineConfig({
  // Relative asset paths so the built site works from any folder or sub-path
  // (GitHub Pages, Netlify, a USB stick…).
  base: './',
  build: { chunkSizeWarningLimit: 1500 },
});
