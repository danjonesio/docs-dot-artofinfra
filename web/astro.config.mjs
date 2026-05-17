import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';

export default defineConfig({
  site: 'https://docs.artofinfra.com',
  publicDir: '../docs',
  outDir: './dist',
  integrations: [
    tailwind({
      applyBaseStyles: false,
    }),
  ],
});
