# portfolio（個人サイト）

Astro のサイト。ページはすべてビルド時に静的化し、Cloudflare Workers の静的アセットとして配信する。
唯一の例外がホームの入力欄が叩く `/api/ask` で、ここだけ Worker 上で動き、Claude に質問を答えさせる。
GitHub のリポジトリ名は `portfolio`、Worker 名とローカルのディレクトリ名は `shogo-site`。

## コマンド

| 目的 | コマンド |
|---|---|
| 開発サーバー | `pnpm dev`（http://localhost:4321） |
| 型チェック＋配色＋回答検証の検査 | `pnpm check` |
| 配色チェックのみ | `pnpm run check:contrast` |
| 回答の検証まわりの検査のみ | `pnpm run check:answer` |
| Worker ごとローカルで動かす | `pnpm run dev:worker`（http://localhost:8787。`/api/ask` を試すのはこちら） |
| ビルド | `pnpm build` |
| ビルド結果の確認 | `pnpm preview` |
| デプロイ | `pnpm run ship` |
| favicon / OGP 画像の再生成 | `pnpm run images` |
| works のサムネイル元画像の再取得 | `node scripts/capture-works.mjs [<id>]` |

- `deploy` という script 名は pnpm の組み込みコマンドと衝突して実行されないため、デプロイは `ship`。
- 通常のデプロイは main への push で GitHub Actions が行う。`pnpm run ship` は手元から流したいとき用。
- `pnpm dev`（astro dev）でもバインディング（KV・レート制限）は使えるので、`/api/ask` はそのまま動く。
  アダプタの Vite プラグインが workerd 上で走らせているため。`pnpm run dev:worker` は「ビルド済みの成果物を
  本番と同じ経路で配信する」確認用で、普段は `pnpm dev` でよい。
- **`astro dev` を動かしたまま `pnpm build` を走らせない。** どちらも `node_modules/.vite` を共有していて、
  build が最適化キャッシュを書き換えると dev 側が消えたハッシュを掴んだまま落ちる。症状はこれ:

  ```
  [vite] Internal server error: The file does not exist at ".../node_modules/.vite/deps_ssr/....js?v=xxxxxxxx"
  which is in the optimize deps directory.
  ```

  直し方は `optimizeDeps.exclude` を足すことではなく、入れ直すこと:

  ```
  npx astro dev stop && rm -rf node_modules/.vite .astro && pnpm dev
  ```

  Astro 7 の `astro dev` は常駐する（`astro dev status` / `logs` / `stop`）。前のプロセスが 4321 を掴んだままだと
  別のポートに逃げるので、動かないときはまず `astro dev status` で実際のポートを見る。
- ビルド結果は `dist/client`（静的）と `dist/server`（Worker）に分かれる。deploy / dev が読むのはアダプタが生成する
  `dist/server/wrangler.json` で、ルートの `wrangler.jsonc` はその元になる設定。バインディングを足すのはルートのほう。
- ローカルで `/api/ask` を動かすには `.dev.vars` に `ANTHROPIC_API_KEY` を書く（`.dev.vars.example` を複製する）。

## 構成

```
src/
├─ consts.ts            サイト名・肩書き・SNS リンク
├─ env.d.ts             Worker のバインディングの型（手書き。理由はファイル冒頭）
├─ content.config.ts    blog / works / log / facts コレクションの zod スキーマ
├─ content/
│  ├─ blog|works|log/   Markdown のコンテンツ
│  └─ facts/            ページになっていない事実。LLM の根拠になる（本人が書く）
├─ lib/
│  ├─ content.ts        一覧の取得・整形
│  ├─ corpus.ts         事実集合の組み立て・質問の正規化・ハッシュ
│  ├─ answer.ts         回答の型 / JSON Schema / sanitizeAnswer（安全境界）
│  └─ space.ts          ホームの 3D 背景（three.js。ブラウザ専用）。ロゴの形は space-logos.ts
├─ layouts/             BaseLayout（全ページ） / PostLayout（記事）
├─ components/          SearchBox（全ページの検索窓） / Answer（ホームの回答表示）
│                       SpaceBackground（ホームの 3D 背景） / ThemeToggle / TermPic
├─ styles/global.css    デザイントークンと全スタイル
└─ pages/
   ├─ api/ask.ts        唯一の動的ルート（prerender = false）
   └─ ...               それ以外は全部ビルド時に静的化される
scripts/check-answer.mts  sanitizeAnswer の検査（依存なし。pnpm check で走る）
public/_headers         Cloudflare が返すレスポンスヘッダー
wrangler.jsonc          Worker とバインディングの設定
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

検索エンジンのような見た目にしてある。ホームは検索窓だけで、質問すると窓が上に縮んで固定され、
答えが本文として出る。他のページも同じ上部バー（ロゴ＋検索窓）を持つ。

- **サンセリフ・ライト基調。** 既定はライトで、選択が無ければ OS の設定に従う。等幅フォントを使うのは
  コード（`.article code`）・404 が出す URL パス・termpic の出力の3つだけ。増やさない。
- **Web フォントは追加しない。** 外部リクエストゼロを維持する。システムフォントのスタックだけで組む。
- 配色は `src/styles/global.css` の CSS 変数で管理する。ライトが基準（`:root`）で、
  ダークは `:root[data-theme="dark"]` が上書きする。**色は必ずこの2ブロックの中で定義する。**
  `@media (prefers-color-scheme: dark)` の中で色を定義すると、検査から漏れる。
- コントラスト比 4.5:1 以上は `scripts/check-contrast.mjs`（自作の
  [contrast-kit](https://www.npmjs.com/package/contrast-kit) を使用）が `pnpm check` の中で検査し、
  CI で強制される。トークンを変えたら必ずこれを通すこと。実際に重なる組み合わせだけを対象にしている
  （本文の背景は `--bg`。`--bg-inset` に載るのはタグ・チップ・コードだけ）。
- **`extractRuleBlock` はセレクタを素の indexOf で探す。** CSS のコメントの中にセレクタ名を書くと
  そちらを先に拾って別のブロックを返すので、`check-contrast.mjs` は検査前にコメントを落としている。
  実際にこれでダークテーマがライトの値で検査され、素通りしていたことがある。
- Google の UI 青 `#1a73e8` は白地で 3.9:1 しかなく、この検査に落ちる。リンクには `#1a0dab` を使っている。
- 上部バーは `.topbar`、状態は `<html>` の `data-mode`（`hero` / `results`）で切り替える。
  DOM は動かさず CSS だけで縮める。`hero` は「ホームで、まだ何も聞かれていないとき」だけ。
- **ホームの `hero` のあいだだけ、three.js の 3D 背景（ロゴが宇宙を流れてくる）を敷く。**
  `SpaceBackground.astro` が hero になってから `src/lib/space.ts` を動的に読み込む（three.js は gzip で 150KB あるので、
  ページには含めない。`?q=` 付きで開かれたら読まない）。results になったら描画を止めて隠す。
  - 色は `space.ts` がトークン（`--bg` / `--fg` / `--fg-dim` / `--accent*`）を読んで塗る。ブランドの色は使わない。
    配色を切り替えると塗り直す。
  - 真ん中は `.space` の `mask-image` で抜いてあり、ロゴ・検索窓・例の質問は素の `--bg` の上に載る。
    配色検査はこの前提で通しているので、マスクを狭めない。
  - 動きを減らす設定（prefers-reduced-motion）では、流さず視差も付けず、その場でゆっくり回すだけにする。
    WebGL が無ければ何も描かない。
  - 浮かべるロゴは React（毎回出る）と、`space-logos.ts` の中から訪問のたびにランダムに選ぶ数種類（`KINDS_PER_VISIT`）。
    `space-logos.ts` に足してよいのは、制作物・記事・整備ログに出てくるか、このサイト自体が使っている技術だけ
    （使っていない技術のロゴは「使える人」に見えてしまう）。形は Simple Icons の path（CC0）。
- 一覧（works / blog / タグ / LLM の filelist）は `.result` の見た目に揃える。
  上に薄くパス、次にタイトルのリンク、その下に説明。新しい一覧を足すときもこれに合わせる。
- 画像は `<TermPic>` でマス目に落として置く。自作の道具の出力そのものなので残してある。
  `cellAspect` の既定は 1.66（`.termpic` が `line-height: 1` のときの実測値）。
- **マス目に落とす元画像は「大きく・平らで・色の差がはっきりした構図」を選ぶ。** 細かい文字は全部つぶれるので、
  ページ全体のスクリーンショットを流し込むと、ただの灰色の面になる。実測で確かめてから採用すること。
- works 詳細のサムネイルは `src/assets/works/<id>.png` があれば自動で付く。用意するのは `node scripts/capture-works.mjs`。
  一覧には付けない。
- `.termpic` は `pre` なので、記事本文のコードブロック用スタイル（`.article pre:not(.termpic)`）から除外してある。
  この `:not()` を外すと行間が効いて、マスとマスのあいだに横縞が出る。
- 記事本文は `.article`（`max-width: var(--measure)` / `line-height: 1.85`）。
- favicon と OGP 画像は `node scripts/generate-images.mjs` が作る。**色はデザイントークンと同じ値を
  ベタ書きしてある**ので、トークンを変えたらこのスクリプトも直して再実行する。

## ホームの ask（LLM が答えるところ）

ホームの入力欄に打った質問を `/api/ask` が受け、**このリポジトリの中身だけ**を根拠に Claude が答える。

### 何を根拠にするか

`src/lib/corpus.ts` が事実集合を組み立てる。出どころは4つだけで、ここに無いことは「書いていない」として扱う。

| 出どころ | 何を入れているか |
|---|---|
| `src/consts.ts` | 表示名・肩書き・連絡先・ページの一覧 |
| `src/content/facts/*.md` | ページになっていない事実と、**書いていないことの明示** |
| `src/content/works/*.md` | フロントマターと本文を丸ごと |
| `src/content/blog/*.md` | タイトル・説明・タグ・見出しだけ（本文は入れない。詳細は記事へ誘導させる） |

記事を書けば事実集合は自動で増える。事実を手で二重に書かないこと。

### 画面の流れ

- 検索窓（`SearchBox.astro`）は全ページに出る。素の `<form action="/" method="get">` なので、
  ホーム以外から検索すると `/?q=...` へ飛ぶだけ。JavaScript が無くても壊れない。
- ホームだけが `Answer.astro` を持ち、`?q=` を読んで `/api/ask` を叩き、答えを描く。
- 質問すると `?q=` を history に積む。**戻るボタンが効き、答えの URL を人に渡せる。**

### なぜ LLM に HTML を書かせないか

出力は `src/lib/answer.ts` の JSON Schema に縛ってある。LLM が選べるのは
「既存の表示パーツ（text / filelist / kv / table / links / notfound）のどれを、どの順で、どの中身で置くか」だけ。
`filelist` は検索結果の見た目（`.result`）で描かれる。

- **`sanitizeAnswer()` を通っていない値は画面に出ない。** ここが唯一の安全境界で、系統プロンプトは境界ではない
  （訪問者の入力で上書きできてしまうため）。
- リンク先は `allowedHrefs`（実在するページと `consts.ts` の外部リンクだけ）に無ければ捨てる。URL を組み立てさせない。
- 描画は `Answer.astro` の中で `textContent` だけを使う。`innerHTML` は使わない。
- パーツが既存の CSS クラスに限られるので、LLM が配色やフォントを増やすことはできない。

### キャッシュとコスト

- 質問は正規化（NFKC・小文字化・空白と語尾記号を落とす）してから SHA-256 でキーにし、KV に30日入れる。
- キーには事実集合のハッシュと `PROMPT_VERSION` が入っている。**記事を足すとキャッシュは自然に無効になる。**
- `DAILY_LLM_BUDGET`（既定 50）が1日あたりの「キャッシュに無かった質問」の上限。超えたらその日はキャッシュだけで答える。
- レート制限は `ASK_LIMIT`（IP あたり 60 秒で 8 回）。
- 何を聞かれたかは1件1行の JSON で `console.log` している。**何が聞かれるかが分かれば、facts に足すべきものが分かる。**

### デプロイに必要なもの

- Worker のシークレット `ANTHROPIC_API_KEY`（`wrangler secret put ANTHROPIC_API_KEY`）。
  未設定でもサイトは壊れず、`/api/ask` だけが「設定されていない」と返す。
- KV 名前空間 `ANSWERS` は `wrangler.jsonc` に id を書いていないので deploy 時に自動で作られる。
  **初回だけは手元から `pnpm run ship` を実行して、作成の確認に答えること。** CI に初回を任せない。

## 自動化されていること

| いつ | 何が起きるか |
|---|---|
| PR / push | CI（`pnpm check` + `pnpm build`） |
| main への push | CI 通過後に Cloudflare へ自動デプロイ |
| 毎日 09:00 JST | Dependabot が依存更新 PR を作成。minor / patch は CI グリーンで自動マージ |
| 毎日 10:43 JST | main を再デプロイ（自動マージは push イベントを発火させないための取りこぼし対策） |
| PR 作成時 | Claude がレビュー（bot が作った PR は対象外） |
| `@claude` コメント | Claude が調査・修正して PR を更新する |

## 自動実行での約束事（重要）

`@claude` への応答など、Claude が Actions 上で動くときは、以下は例外なく守ること。

- **main へ直接 push しない。** 変更は必ず `claude/<テーマ>` のようなブランチと PR で出す。`git push --force` も禁止。
- **`.github/` 配下と `CLAUDE.md` を変更した PR は自動マージしない。** 自動化の設定そのものは人間のレビューを通す。
- **`src/consts.ts` の連絡先（メール・SNS）は本人が公開すると決めた値。勝手に変更・削除しない。** git の設定や履歴から別のアドレスを拾って書き換えてはいけない（アカウントのメールと公開用のメールは別物）。連絡先を変えるのは本人だけ。
- **`src/content/facts/` は本人が書く場所。Claude は事実を足さない・書き換えない・消さない。** `src/consts.ts` の連絡先と同じ扱い。
  ここに書いたことがそのまま「本人についての事実」として訪問者に答えられる。誤字の修正も本人に確認する。
  「書いていないこと」を列挙した行を消すのは特に危険で、消すと LLM が推測で埋め始める。
- **`/api/ask` の安全装置を緩めない。** 具体的には次のどれもやらない。
  - `sanitizeAnswer()` の検査や上限を外す・広げる
  - `allowedHrefs` に「実在するページ以外」を足す
  - `Answer.astro` の描画を `textContent` から `innerHTML` に変える
  - 系統プロンプトの「破ってはいけないこと」を弱める
  - `DAILY_LLM_BUDGET` や `ASK_LIMIT` を上げる
  - `MODEL` や `PROMPT_VERSION` を変える
  これらを変えたくなったら、直さずに issue で提案する。`scripts/check-answer.mts` の検査も減らさない。
- **本人に関する事実を創作しない。** 経歴・実績・所属・肩書きを推測で書き足さない。`src/pages/about.astro` の TODO 行は TODO のまま残す。
- 記事本文（`src/content/blog/*.md`）の変更は、誤字・リンク切れ・技術的な誤りの修正に限る。主張や語り口は書き換えない。
- `src/assets/` の元画像は公開されない。`<TermPic>` がビルド時に読んでマス目に落とし、その結果だけが HTML に入る。元画像を `public/` に移動しないこと。
- デザイン変更は `src/styles/global.css` の既存 CSS 変数の範囲内で行う。新しい色・フォント・Web フォントを増やさない。
- 依存を増やさない。必要だと判断したら、直さずに issue で提案する。
- 1回の実行で扱うテーマは1つに絞り、差分は必要最小限にする。
- 整備ログ（`src/content/log/`）は1日1ファイル。既存のログファイルは編集しない。実行していない点検を「実施した」と書かない。
- `astro.config.mjs` の `site` を変えるときは `public/robots.txt` の Sitemap 行も一緒に変える。RSS・sitemap・canonical の絶対 URL がこの値に依存している。
- `public/_headers` に CSP は入れていない。テーマ初期化と 404 ページがインラインスクリプトを使っており、`script-src 'self'` では動かなくなるため。入れるならインラインスクリプトの扱いを先に解決すること。
