# portfolio（個人サイト）

Astro の静的サイト。ビルド結果を Cloudflare Workers の静的アセットとして配信する。
GitHub のリポジトリ名は `portfolio`、Worker 名とローカルのディレクトリ名は `shogo-site`。

## コマンド

| 目的 | コマンド |
|---|---|
| 開発サーバー | `pnpm dev`（http://localhost:4321） |
| 型チェック＋配色チェック | `pnpm check` |
| 配色チェックのみ | `pnpm run check:contrast` |
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

- 記事は `src/content/blog/<slug>.md`、制作物は `src/content/works/<slug>.md`、整備ログは `src/content/log/<YYYY-MM-DD>.md`。ファイル名がそのまま URL になる。
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
- 配色は `src/styles/global.css` の CSS 変数で管理する。本文・リンクのコントラスト比 4.5:1 以上は
  `scripts/check-contrast.mjs`（自作の [contrast-kit](https://www.npmjs.com/package/contrast-kit) を使用）が
  `pnpm check` の中で検査し、CI で強制される。トークンを変えたら必ずこれを通すこと。
  実際に重なる組み合わせだけを検査対象にしている（本文の背景は `--bg` ではなく `--bg-elev`）。
- 記事本文だけは可読性優先（`max-width: 44em` / `line-height: 1.95`）。

## 自動化されていること

| いつ | 何が起きるか |
|---|---|
| PR / push | CI（`pnpm check` + `pnpm build`） |
| main への push | CI 通過後に Cloudflare へ自動デプロイ |
| 毎日 09:17 JST | Claude が点検し、直せるものは PR にして自動マージする。直せないものは issue にする。**変更の有無にかかわらず `src/content/log/<日付>.md` に整備ログを残す**（`/log/` に表示される） |
| 毎日 09:00 JST | Dependabot が依存更新 PR を作成。minor / patch は CI グリーンで自動マージ |
| 毎日 10:43 JST | main を再デプロイ（自動マージは push イベントを発火させないための取りこぼし対策） |
| PR 作成時 | Claude がレビュー（bot が作った PR は対象外） |
| `@claude` コメント | Claude が調査・修正して PR を更新する |

## 自動実行での約束事（重要）

日次の自動改修は人のレビューを経ずに本番へ出る。以下は例外なく守ること。

- **main へ直接 push しない。** 変更は必ず `claude/daily-<YYYY-MM-DD>` のようなブランチと PR で出す。`git push --force` も禁止。
- **`.github/` 配下と `CLAUDE.md` を変更した PR は自動マージしない。** 自動化の設定そのものは人間のレビューを通す。
- **`src/consts.ts` の連絡先（メール・SNS）は本人が公開すると決めた値。勝手に変更・削除しない。** git の設定や履歴から別のアドレスを拾って書き換えてはいけない（アカウントのメールと公開用のメールは別物）。連絡先を変えるのは本人だけ。
- **本人に関する事実を創作しない。** 経歴・実績・所属・肩書きを推測で書き足さない。`src/pages/about.astro` の TODO 行は TODO のまま残す。
- 記事本文（`src/content/blog/*.md`）の変更は、誤字・リンク切れ・技術的な誤りの修正に限る。主張や語り口は書き換えない。
- デザイン変更は `src/styles/global.css` の既存 CSS 変数の範囲内で行う。新しい色・フォント・Web フォントを増やさない。
- 依存を増やさない。必要だと判断したら、直さずに issue で提案する。
- 1回の実行で扱うテーマは1つに絞り、差分は必要最小限にする。直すものが無ければコードは変更しない（整備ログだけを残す）。
- 整備ログは1日1ファイル。既存のログファイルは編集しない。実行していない点検を「実施した」と書かない。
- `astro.config.mjs` の `site` を変えるときは `public/robots.txt` の Sitemap 行も一緒に変える。RSS・sitemap・canonical の絶対 URL がこの値に依存している。
- `public/_headers` に CSP は入れていない。テーマ初期化と 404 ページがインラインスクリプトを使っており、`script-src 'self'` では動かなくなるため。入れるならインラインスクリプトの扱いを先に解決すること。
