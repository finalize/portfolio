---
title: Astro と Cloudflare Workers で個人サイトを作った
description: Astro 7 の静的ビルドを Cloudflare Workers の静的アセットとして配信するまでの構成と、実際にハマったところのメモ。
pubDate: 2026-08-22
tags:
  - astro
  - cloudflare
  - typescript
---

個人サイトが無いままだったので、Astro で作って Cloudflare Workers に載せた。構成と、作る途中で引っかかったところを残しておく。

## なぜ Astro か

やりたかったのは「プロフィール・制作物・記事を置くだけ」で、動的な処理はひとつも要らなかった。

- ビルド結果が素の HTML なので、配信側にランタイムが不要
- Markdown をそのままコンテンツとして扱える（Content Collections）
- 必要になったら後から React などを部分的に載せられる

この3つが揃っているのが決め手だった。

## 構成

```
src/
├─ content.config.ts    コレクション定義（zod でフロントマターを検証）
├─ content/
│  ├─ blog/*.md         記事
│  └─ works/*.md        制作物
├─ layouts/             ページ全体と記事の枠
├─ components/          プロンプト行やテーマ切替
└─ pages/               ルーティング
```

記事のフロントマターは zod で型を付けている。必須項目が抜けているとビルドが落ちるので、書き忘れに気づける。

```ts
const blog = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/blog' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    pubDate: z.coerce.date(),
    tags: z.array(z.string()).default([]),
    draft: z.boolean().default(false),
  }),
});
```

`draft: true` の記事は開発中だけ表示して、本番ビルドからは除外している。

## Cloudflare Workers へのデプロイ

完全静的なサイトなので、アダプタは要らない。`wrangler.jsonc` に `dist/` を指すだけでいい。

```jsonc
{
  "name": "shogo-site",
  "compatibility_date": "2026-08-22",
  "assets": {
    "directory": "./dist",
    "not_found_handling": "404-page"
  }
}
```

あとは `astro build` してから `wrangler deploy` するだけ。`main` を書いていないので、Worker のコードは1行も動かない。

## ハマったところ

Astro 7 でコンパイラが Rust 実装に置き換わっていて、以前は黙って直されていた不正な HTML がエラーになる。閉じタグの書き忘れがそのまま失敗するので、最初は面食らった。

もうひとつは `compressHTML` の既定値が `'jsx'` に変わったこと。インライン要素のあいだの改行や空白が詰められるので、`<span>` を横に並べて空白で間隔を作っていると全部くっつく。間隔は CSS の `gap` や `margin` で付けるのが正しい。

## これから

まずは書くことに慣れるところから。OGP 画像の自動生成や記事の検索は、必要になったら足す。
