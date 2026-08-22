# portfolio（個人サイト）

Astro の静的サイト。ビルド結果を Cloudflare Workers の静的アセットとして配信する。
GitHub のリポジトリ名は `portfolio`、Worker 名とローカルのディレクトリ名は `shogo-site`。

## コマンド

| 目的 | コマンド |
|---|---|
| 開発サーバー | `pnpm dev`（http://localhost:4321） |
| 型チェック | `pnpm check` |
| ビルド | `pnpm build` |
| ビルド結果の確認 | `pnpm preview` |
| デプロイ | `pnpm run ship` |
| favicon / OGP 画像の再生成 | `pnpm run images` |

- `deploy` という script 名は pnpm の組み込みコマンドと衝突して実行されないため、デプロイは `ship`。
- 通常のデプロイは main への push で GitHub Actions が行う。`pnpm run ship` は手元から流したいとき用。

## 構成

```
src/
├─ consts.ts            サイト名・肩書き・SNS リンク
├─ content.config.ts    blog / works コレクションの zod スキーマ
├─ content/blog|works/  Markdown のコンテンツ
├─ layouts/             BaseLayout（全ページ） / PostLayout（記事）
├─ components/          Prompt / ThemeToggle
├─ styles/global.css    デザイントークンと全スタイル
└─ pages/               ルーティング
public/_headers         Cloudflare が返すレスポンスヘッダー
wrangler.jsonc          静的アセット配信の設定（Worker コードは持たない）
```

## コンテンツを足すときの決まり

- 記事は `src/content/blog/<slug>.md`、制作物は `src/content/works/<slug>.md`。ファイル名がそのまま URL になる。
- フロントマターは `src/content.config.ts` の zod スキーマで検証される。必須項目が欠けるとビルドが落ちる。
- **YAML の値に `: `（コロン＋空白）が含まれる場合は必ずダブルクォートで囲む。** 例: `description: "draft: true を付けた記事は…"`。囲まないとパースエラーになる。
- **タグは ASCII 小文字にする。** `/blog/tags/<tag>/` として URL に出るため。
- `draft: true` の記事・制作物は `pnpm dev` では見えるが、本番ビルドと RSS には出ない。

## Astro 7 の注意

- Rust コンパイラは不正な HTML を許さない。閉じタグ忘れはビルドエラーになる。
- `compressHTML` の既定が `'jsx'`。インライン要素のあいだの改行や空白は詰められるので、間隔は CSS の `gap` / `margin` で付ける。
- **日本語の1段落は1行で書く。** 複数行に折り返すと改行が半角スペースになり、文中に不自然な隙間ができる。
- Markdown プラグイン（remark / rehype）は既定では動かない。記事は素の Markdown だけで完結させる。

## デザインの決まり

- ターミナル風。等幅フォント、ダーク基調。プロンプト行を描画するのは `src/components/Prompt.astro` だけ。
- **Web フォントは追加しない。** 外部リクエストゼロを維持する。
- 配色は `src/styles/global.css` の CSS 変数で管理し、本文・リンクのコントラスト比は 4.5:1 以上を保つ。
- 記事本文だけは可読性優先（`max-width: 44em` / `line-height: 1.95`）。

## 自動化されていること

| いつ | 何が起きるか |
|---|---|
| PR / push | CI（`pnpm check` + `pnpm build`） |
| main への push | CI 通過後に Cloudflare へ自動デプロイ |
| 毎週月曜 | Dependabot が依存更新 PR を作成。minor / patch は CI グリーンで自動マージ |
| 毎週月曜 | Claude が点検（脆弱性・リンク切れ・メジャー更新）し、必要なら issue を1件作る |
| PR 作成時 | Claude が自動レビュー |
| `@claude` コメント | Claude が調査・修正して PR を更新する |

## 自動実行での約束事（重要）

- **main へ直接 push しない。** 変更は必ずブランチと PR で出す。
- **`src/consts.ts` のメールアドレスと SNS ハンドルはプレースホルダのまま残す。** git の設定や履歴から実在のアドレスを拾って埋めてはいけない。個人情報を公開サイトに載せる判断は本人が行う。
- `astro.config.mjs` の `site` を変えるときは `public/robots.txt` の Sitemap 行も一緒に変える。RSS・sitemap・canonical の絶対 URL がこの値に依存している。
- `public/_headers` に CSP は入れていない。テーマ初期化と 404 ページがインラインスクリプトを使っており、`script-src 'self'` では動かなくなるため。入れるならインラインスクリプトの扱いを先に解決すること。
- 依存を増やすときは理由を PR に書く。この構成の利点はランタイムも外部リクエストも持たないこと。
