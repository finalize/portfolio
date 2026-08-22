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

## 自動化

| いつ | 何が起きるか | ファイル |
|---|---|---|
| PR / push | 型チェック（`pnpm check`）とビルド | `.github/workflows/ci.yml` |
| main への push | CI 通過後に Cloudflare へ自動デプロイ | 同上（`deploy` ジョブ） |
| 毎週月曜 09:00 JST | Dependabot が依存更新 PR を作成。minor / patch は CI グリーンで自動マージ、メジャーはレビュー待ちで残る | `.github/dependabot.yml` / `dependabot-auto-merge.yml` |
| 毎週月曜 09:00 JST | Claude が点検（脆弱性・メジャー更新・リンク切れ）し、対応が必要なら issue を1件作る | `claude-maintenance.yml` |
| PR 作成時 | Claude がレビューし、指摘をインラインコメントで残す | `claude-review.yml` |
| `@claude` コメント | Claude が調査・修正してブランチに push する | `claude.yml` |

main は「check & build の通過」を必須にしてあるので、自動処理経由でも壊れたコードは入らない（管理者は必要なら直接 push できる）。

### 必要なシークレット

| 名前 | 用途 | 取り方 |
|---|---|---|
| `CLAUDE_CODE_OAUTH_TOKEN` | Actions 内の Claude の認証（サブスク） | `claude setup-token` |
| `CLOUDFLARE_API_TOKEN` | 自動デプロイ | ダッシュボード → API トークン → Custom の「Edit Cloudflare Workers」テンプレート |
| `CLOUDFLARE_ACCOUNT_ID` | 自動デプロイ | Cloudflare ダッシュボードの Workers 画面に表示される Account ID |

```bash
gh secret set CLAUDE_CODE_OAUTH_TOKEN
gh secret set CLOUDFLARE_API_TOKEN
gh secret set CLOUDFLARE_ACCOUNT_ID
```

Claude のワークフローには [Claude GitHub App](https://github.com/apps/claude) のインストールも必要。
シークレットが無いあいだ、該当ジョブはスキップされるだけで CI は落ちない。

### 注意

- Dependabot が起点の実行には Actions のシークレットが渡らない（Dependabot 用の別ストアになる）ため、Dependabot の PR に Claude のレビューは走らない。直したいときは PR に `@claude CIを直して` とコメントする。
- public リポジトリでは、60日間リポジトリに動きがないと GitHub が cron を自動停止する。止まったら Actions の画面から再有効化する。
