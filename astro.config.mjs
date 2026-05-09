// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import vercel from '@astrojs/vercel';

export default defineConfig({
  site: 'https://o-cobogo.vercel.app',
  output: 'server',
  adapter: vercel(),
  integrations: [react()],
});
