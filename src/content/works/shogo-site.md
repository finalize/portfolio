---
title: shogo.jp
summary: この個人サイト。Astro の静的ビルドを Cloudflare Workers で配信している。
stack:
  - Astro
  - TypeScript
  - Cloudflare Workers
repo: https://github.com/finalize/portfolio
year: 2026
order: 100
---

プロフィール・制作物・ブログをまとめた個人サイト。ターミナルの画面をそのままページにしたような見た目にした。

- 記事と制作物は Markdown（Content Collections）で管理
- ビルドは完全静的。ランタイムもデータベースも持たない
- `astro build` した `dist/` を Cloudflare Workers の静的アセットとして配信

作った経緯は [ブログ記事](/blog/astro-personal-site/) に書いた。
