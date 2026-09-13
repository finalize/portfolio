/**
 * src/styles/global.css のデザイントークンについて、
 * 実際に重なる配色の組み合わせが WCAG の基準を満たすか検査する。
 *
 *   node scripts/check-contrast.mjs
 *
 * 基準を満たさない組み合わせが1つでもあれば終了コード 1 で落ちる。
 */
import { readFile } from "node:fs/promises";
import { auditPairs, extractRuleBlock, parseCssVariables, suggestAccessible } from "contrast-kit";

const CSS_PATH = new URL("../src/styles/global.css", import.meta.url);

/**
 * 実際に画面上で重なる組み合わせだけを並べる。
 * 本文は素の背景（--bg）の上に載る。チップ・タグ・コードだけが --bg-inset に載る。
 */
const PAIRS = [
  { label: "本文", fg: "--fg", bg: "--bg" },
  { label: "スニペット・メタ", fg: "--fg-dim", bg: "--bg" },
  { label: "検索結果のタイトル", fg: "--accent-2", bg: "--bg" },
  { label: "主要な操作・フォーカス", fg: "--accent", bg: "--bg" },
  { label: "日付・タグ", fg: "--accent-3", bg: "--bg" },
  { label: "エラー・下書き表示", fg: "--danger", bg: "--bg" },
  { label: "タグの文字", fg: "--accent-3", bg: "--bg-inset" },
  { label: "チップの文字", fg: "--fg-dim", bg: "--bg-inset" },
  { label: "インラインコード", fg: "--fg", bg: "--bg-inset" },
  { label: "フッターの文字", fg: "--fg-dim", bg: "--bg-elev" },
  { label: "表の見出し", fg: "--fg", bg: "--bg-elev" },
  // 枠線は文字ではないので WCAG 1.4.11 の 3:1（large の閾値と同値なので流用する）。
  // ただし情報を伝えない装飾の枠線は対象外で、このサイトの枠線は面を仕切るためのもの。
  // 判断が分かれるので参考表示に留め、これだけではビルドを落とさない。
  { label: "枠線（参考・非テキスト 3:1）", fg: "--border", bg: "--bg", large: true, advisory: true },
];

const THEMES = [
  { name: "light", selector: ":root" },
  { name: "dark", selector: ':root[data-theme="dark"]' },
];

function readPalette(css, selector) {
  const block = extractRuleBlock(css, selector);
  if (block === undefined) {
    throw new Error(`セレクタ ${selector} が global.css に見つかりません`);
  }
  return parseCssVariables(block);
}

/*
   contrast-kit の extractRuleBlock はセレクタを素の indexOf で探すので、
   コメントの中にセレクタ名が書いてあると、そちらを先に拾って別のブロックを返す。
   （実際に :root[data-theme="dark"] という文字列を冒頭のコメントに書いたら、
     ダークテーマがライトの値で検査され、素通りしていた）
   検査の前にコメントを落としておく。
*/
const css = (await readFile(CSS_PATH, "utf8")).replace(/\/\*[\s\S]*?\*\//g, "");
const base = readPalette(css, THEMES[0].selector);

let failures = 0;
console.log("配色チェック（src/styles/global.css）\n");

for (const theme of THEMES) {
  // ダークテーマは上書きした変数だけを持つので、ライトの値に重ねて解決する
  const palette = theme.name === "light" ? base : { ...base, ...readPalette(css, theme.selector) };

  const missing = PAIRS.flatMap(({ fg, bg }) => [fg, bg]).filter((name) => !palette[name]);
  if (missing.length > 0) {
    throw new Error(`${theme.name}: 変数が見つかりません: ${[...new Set(missing)].join(", ")}`);
  }

  const results = auditPairs(
    PAIRS.map((pair) => ({
      name: pair.label,
      fg: palette[pair.fg],
      bg: palette[pair.bg],
      large: pair.large ?? false,
    })),
  );

  console.log(`  ${theme.name}`);
  for (const [index, result] of results.entries()) {
    const { fg, bg } = PAIRS[index];
    const advisory = PAIRS[index].advisory ?? false;
    const mark = result.passes ? "OK  " : advisory ? "--  " : "NG  ";
    const ratio = `${result.ratio.toFixed(2)}:1`.padStart(8);
    console.log(
      `    ${mark}${result.name.padEnd(28)} ${`${fg} / ${bg}`.padEnd(30)} ${ratio}  ${result.level}`,
    );

    if (result.passes || advisory) continue;
    failures++;

    // 「足りない」だけでなく直し方も出す
    const fix = suggestAccessible(result.fg, result.bg, { large: result.large });
    console.log(
      fix === undefined
        ? `        → 明度を振り切っても届きません。色相から見直す必要があります`
        : `        → ${fg} を ${fix.color} にすれば ${fix.ratio.toFixed(2)}:1`,
    );
  }
  console.log("");
}

if (failures > 0) {
  console.error(`${failures} 件が基準を満たしていません。`);
  process.exit(1);
}
console.log("テキストの組み合わせはすべて基準を満たしています（-- は参考項目）。");
