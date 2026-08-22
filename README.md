# portfolio

個人サイト（プロフィール / 制作物 / ブログ）。Astro の静的ビルドを Cloudflare Workers の静的アセットとして配信する。

```
src/
├─ consts.ts            サイト名・肩書き・SNS リンク（★まずここを書き換える）
├─ content.config.ts    blog / works コレクションの定義（zod スキーマ）
├─ content/
│  ├─ blog/*.md         記事
│  └─ works/*.md        制作物
├─ layouts/             BaseLayout（全ページ共通） / PostLayout（記事）
├─ components/          Prompt（`~/shogo $ ...` の行） / ThemeToggle
├─ styles/global.css    デザイントークンと全スタイル
└─ pages/               ルーティング
```

## 開発

```bash
pnpm dev        # http://localhost:4321
pnpm build      # dist/ に静的出力
pnpm preview    # dist/ をローカルで配信
pnpm check      # 型チェック（astro check）
```

## 記事を書く

`src/content/blog/<slug>.md` を作る。ファイル名がそのまま URL（`/blog/<slug>/`）になる。

```md
---
title: 記事のタイトル
description: 一覧と OGP に出る説明
pubDate: 2026-08-22
tags:
  - astro
draft: false
---
```

- `draft: true` の記事は `pnpm dev` では見えるが、本番ビルド・RSS には出ない
- タグは URL に出るので ASCII（英小文字）にしておく
- 制作物は `src/content/works/<slug>.md`。`src/content/works/example.md` が雛形

## デプロイ（Cloudflare Workers）

初回だけログインする。

```bash
pnpm exec wrangler login
```

以降はこれだけ。

```bash
pnpm run ship   # astro build && wrangler deploy
```

`wrangler.jsonc` は `dist/` を静的アセットとして配信する設定で、Worker のコードは持たない（`main` なし）。

## 独自ドメインをつなぐ

1. `.jp` は Cloudflare Registrar 非対応なので、国内レジストラ（お名前.com / Value Domain / Xserver ドメイン等）で取得する
2. Cloudflare にサイトとして追加し、提示されたネームサーバをレジストラ側で設定する
3. ゾーンが Active になったら、Worker の Settings → Domains & Routes → Add Custom Domain でドメインを追加
4. `astro.config.mjs` の `site` と `public/robots.txt` の Sitemap 行を本番ドメインに書き換えて再デプロイ

## 画像

`public/favicon.svg` を編集して `pnpm run images` を実行すると、favicon.png / apple-touch-icon.png / og.png が再生成される。
OGP の文言は `scripts/generate-images.mjs` の `OG_TEXT` にある。
