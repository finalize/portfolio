// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  // TODO: 独自ドメイン取得後にここを差し替える（RSS / sitemap / OGP の絶対URLがこれに依存）
  site: 'https://shogo-site.workers.dev',
  integrations: [sitemap()],
});
