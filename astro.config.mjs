// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  // 独自ドメイン取得後はここを差し替える（RSS / sitemap / OGP の絶対URLがこれに依存）
  // 変更時は public/robots.txt の Sitemap 行も一緒に直すこと
  site: 'https://shogo-site.shgysd.workers.dev',
  integrations: [sitemap()],
});
