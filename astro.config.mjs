// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import vercel from '@astrojs/vercel';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://ocobogo.com.br',
  output: 'server',
  adapter: vercel(),
  integrations: [
    react(),
    sitemap({
      // Só páginas públicas; admin e api ficam de fora do índice.
      filter: (page) => !page.includes('/admin') && !page.includes('/api'),
    }),
  ],
});
