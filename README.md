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

## 画像

画像は `<TermPic>` コンポーネントでマス目に落として置く。ビルド時に [termpic](https://www.npmjs.com/package/termpic) で変換するので、**元画像は公開されず**、HTML に入るのは変換結果だけ。

```astro
<TermPic src="src/assets/avatar.jpeg" alt="説明" mode="quadrant" cols={40} width={132} />
```

出力は文字なので、拡大しても選択してもテキストのまま。`width` は表示幅（px）で、そこからフォントサイズを逆算するため、**マス数を増やしても表示の大きさは変わらない**。

| モード | 1マスの分割 | 40マスのアバターの実測 |
|---|---|---|
| `halfblock` | 1x2 | 粗いが軽い |
| `quadrant` | 2x2 | 横の解像度が倍。38.9KB → gzip 3.6KB |
| `braille` | 2x4 | 最も細かいが、写真では点の粒が目立つ |

## デプロイ（Cloudflare Workers）

いまは公開していない。2026-11-02 に Cloudflare の Worker（`shogo-site`）と KV（`shogo-site-answers`・`shogo-site-session`）を消し、
CI からデプロイを外した。依存の自動更新（Dependabot と自動マージ）も止めた。
また出すときは KV を作り直して `wrangler.jsonc` の id を書き換え、Worker のシークレット `ANTHROPIC_API_KEY` を入れ直してから、下の手順で出す。

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
| PR 作成時 | Claude がレビューしてインラインコメント（bot の PR は対象外） | `claude-review.yml` |
| `@claude` コメント | Claude が調査・修正してブランチに push する | `claude.yml` |

main は「check & build の通過」を必須にしてあるので、自動処理経由でも壊れたコードは入らない（管理者は必要なら直接 push できる）。

### Claude が直す範囲と歯止め

Claude が自分の判断で直してよいのは、依存のメジャー更新対応・壊れたリンクや設定の不整合・アクセシビリティ / SEO の明確な欠落・文面やデザインの修正。制約の全文は `CLAUDE.md` の「自動実行での約束事」にある。要点だけ挙げると:

- 変更前に `pnpm check` と `pnpm build` が通ることを Claude 自身が確認し、CI でも再検証する
- `.github/` と `CLAUDE.md` の変更は必ず人がレビューする（Claude が自分の制約を書き換えて通せないようにするため）
- 連絡先のプレースホルダは埋めない。経歴などの事実を創作しない。記事の主張や語り口は書き換えない
- 新しい依存・色・フォントは足さない。1回の実行で扱うテーマは1つ、差分は最小限

### 気に入らない変更を取り消す

Claude の PR は squash マージなので、1つのコミットが1回分の変更に対応する。

```bash
git revert <コミット>
git push origin main
```

### 必要なシークレット

| 名前 | 用途 | 取り方 |
|---|---|---|
| `CLAUDE_CODE_OAUTH_TOKEN` | Actions 内の Claude の認証（サブスク） | `claude setup-token` |

```bash
gh secret set CLAUDE_CODE_OAUTH_TOKEN
```

Claude のワークフローには [Claude GitHub App](https://github.com/apps/claude) のインストールも必要。
シークレットが無いあいだ、該当ジョブはスキップされるだけで CI は落ちない。
