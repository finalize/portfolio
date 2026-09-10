// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import cloudflare from '@astrojs/cloudflare';

// https://astro.build/config
export default defineConfig({
  // 独自ドメイン取得後はここを差し替える（RSS / sitemap / OGP の絶対URLがこれに依存）
  // 変更時は public/robots.txt の Sitemap 行も一緒に直すこと
  site: 'https://shogo-site.shgysd.workers.dev',
  // ページは今までどおり全部ビルド時に静的化する。
  // `export const prerender = false` を書いたルート（/api/ask）だけが Worker 上で動く。
  // TermPic がビルド時に sharp（ネイティブモジュール）を使うので、
  // 静的ページの事前生成は workerd ではなく Node で走らせる。
  adapter: cloudflare({ prerenderEnvironment: 'node' }),
  integrations: [sitemap()],
});
