---
title: contrast-kit
summary: WCAG のコントラスト比を計算・監査するライブラリと Web ツール。このサイトの配色もこれで検査している。
stack:
  - TypeScript
  - Vite+
  - Cloudflare Workers
repo: https://github.com/finalize/contrast-kit
url: https://contrast-kit.shgysd.workers.dev
year: 2026
order: 110
---

配色が WCAG のコントラスト基準を満たしているかを調べるライブラリと、それを使った Web ツール。

きっかけは、このサイトのライトテーマで `--accent` が背景に対して 4.46:1 になっていて、基準の 4.5:1 をわずかに割っていたのを長いあいだ見逃していたこと。目視では気づけないし、その場で電卓を叩いても仕組みとしては何も残らない。だったら計算を道具にしてしまおう、と考えて作った。

## ライブラリ（[npm](https://www.npmjs.com/package/contrast-kit)）

依存ゼロ。コントラスト比の計算、CSS カスタムプロパティの解析、複数の組み合わせの一括監査。

```ts
import { contrastRatio, wcagLevel } from "contrast-kit";

const ratio = contrastRatio("#1a7f37", "#eef1ee"); // 4.462...
wcagLevel(ratio);                                   // "fail"
wcagLevel(ratio, { large: true });                  // "AA"
```

## Web ツール

CSS を貼り付けると、全組み合わせのコントラスト比を表にして出す。セルの背景色と文字色に実際の色を当てているので、数値だけでなく見た目でも確かめられる。

## このサイトとのつながり

作ったライブラリを、このサイトの CI に組み込んである。デザイントークンを変更すると `pnpm check` が全ページで実際に重なる配色を検査し、本文が 4.5:1 を割ると CI が落ちて自動マージも止まる。最初に見逃した種類の問題は、もう手作業では通り抜けられない。

## 技術的なメモ

Vite+（`vp`）のモノレポで、ライブラリと Web ツールを1つのリポジトリに入れている。テストは Node で回す純粋な関数のものと、実物の Chromium で動かす DOM のものを分けた。表の中身は「色そのもの」で、数値のアサーションでは正しい色で描画されたかを確認できないため、表を画像として比較するビジュアルリグレッションも入れている。
