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
 * 本文は .shell（--bg-elev）の上に載るので、--bg ではなく --bg-elev が背景になる。
 */
const PAIRS = [
  { label: "本文", fg: "--fg", bg: "--bg-elev" },
  { label: "補足テキスト", fg: "--fg-dim", bg: "--bg-elev" },
  { label: "プロンプトのパス・現在ページ", fg: "--accent", bg: "--bg-elev" },
  { label: "リンク・コマンド名", fg: "--accent-2", bg: "--bg-elev" },
  { label: "日付・タグ", fg: "--accent-3", bg: "--bg-elev" },
  { label: "404 のエラー行", fg: "--danger", bg: "--bg-elev" },
  { label: "タイトルバーの文字", fg: "--fg-dim", bg: "--bg-inset" },
  { label: "インラインコード", fg: "--fg", bg: "--bg-inset" },
  // 枠線は文字ではないので WCAG 1.4.11 の 3:1（large の閾値と同値なので流用する）。
  // ただし情報を伝えない装飾の枠線は対象外で、このサイトの枠線は
  // ターミナル風の見た目のためのもの。判断が分かれるので参考表示に留め、
  // これだけではビルドを落とさない。
  { label: "枠線（参考・非テキスト 3:1）", fg: "--border", bg: "--bg-elev", large: true, advisory: true },
];

const THEMES = [
  { name: "dark", selector: ":root" },
  { name: "light", selector: ':root[data-theme="light"]' },
];

function readPalette(css, selector) {
  const block = extractRuleBlock(css, selector);
  if (block === undefined) {
    throw new Error(`セレクタ ${selector} が global.css に見つかりません`);
  }
  return parseCssVariables(block);
}

const css = await readFile(CSS_PATH, "utf8");
const base = readPalette(css, THEMES[0].selector);

let failures = 0;
console.log("配色チェック（src/styles/global.css）\n");

for (const theme of THEMES) {
  // ライトテーマは上書きした変数だけを持つので、ダークの値に重ねて解決する
  const palette = theme.name === "dark" ? base : { ...base, ...readPalette(css, theme.selector) };

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
