# portfolio

個人サイト（プロフィール / 制作物 / ブログ）。Astro の静的ビルドを Cloudflare Workers の静的アセットとして配信する。

```
src/
├─ consts.ts            サイト名・肩書き・SNS リンク（★まずここを書き換える）
├─ content.config.ts    blog / works コレクションの定義（zod スキーマ）
├─ content/
│  ├─ blog/*.md         記事
│  ├─ works/*.md        制作物
│  └─ log/*.md          整備ログ（Claude が毎日1件追記。/log/ に表示）
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
| 毎日 09:17 JST | Claude が点検し、**直せるものは PR にして自動マージ**。直せないものは issue にする。変更の有無にかかわらず `/log/` に整備ログを1件残す | `claude-maintenance.yml` |
| 毎日 09:00 JST | Dependabot が依存更新 PR を作成。minor / patch は CI グリーンで自動マージ、メジャーはレビュー待ちで残る | `.github/dependabot.yml` / `dependabot-auto-merge.yml` |
| 毎日 10:43 JST | main を再デプロイ | `ci.yml`（`schedule`） |
| PR 作成時 | Claude がレビューしてインラインコメント（bot の PR は対象外） | `claude-review.yml` |
| `@claude` コメント | Claude が調査・修正してブランチに push する | `claude.yml` |

main は「check & build の通過」を必須にしてあるので、自動処理経由でも壊れたコードは入らない（管理者は必要なら直接 push できる）。

### 自動改修の範囲と歯止め

Claude が自分の判断で直してよいのは、依存のメジャー更新対応・壊れたリンクや設定の不整合・アクセシビリティ / SEO の明確な欠落・文面やデザインの修正。制約の全文は `CLAUDE.md` の「自動実行での約束事」にある。要点だけ挙げると:

- 変更前に `pnpm check` と `pnpm build` が通ることを Claude 自身が確認し、CI でも再検証してから自動マージされる
- `.github/` と `CLAUDE.md` を触った PR は**自動マージされない**（Claude が自分の制約を書き換えて通せないようにするため）
- 連絡先のプレースホルダは埋めない。経歴などの事実を創作しない。記事の主張や語り口は書き換えない
- 新しい依存・色・フォントは足さない。1回の実行で扱うテーマは1つ、差分は最小限

### 気に入らない変更を取り消す

自動改修は squash マージなので、1つのコミットが1回分の改修に対応する。

```bash
git revert <コミット>
git push origin main        # CI が走って自動で再デプロイされる
```

コードは戻さず配信だけ即座に戻したいときは、Cloudflare 側のバージョンをロールバックする。

```bash
pnpm exec wrangler rollback              # 直前のバージョンへ
pnpm exec wrangler versions list         # 戻し先を選びたいとき
```

自律実行を一時的に止めたいときは、Actions の画面で `Claude Maintenance` ワークフローを Disable する。

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
