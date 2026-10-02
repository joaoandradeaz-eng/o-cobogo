// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import vercel from '@astrojs/vercel';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://ocobogo.com.br',
  output: 'server',
  adapter: vercel(),
  // Endereços antigos de textos que mudaram de título depois de publicados.
  redirects: {
    '/conselhos-a-um-jovem-eleitor': '/teoria-do-bom-eleitor',
  },
  integrations: [
    react(),
    sitemap({
      // Só páginas públicas; admin e api ficam de fora do índice.
      filter: (page) => !page.includes('/admin') && !page.includes('/api'),
    }),
  ],
});
