/**
 * favicon / OGP 画像を SVG から生成する。
 *   node scripts/generate-images.mjs
 * 名前や文言を変えたら OG_TEXT を直して再実行する（src/consts.ts と揃える）。
 * 色は src/styles/global.css のライトテーマのトークンと同じ値にしてある。
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import sharp from 'sharp';

const root = path.dirname(fileURLToPath(new URL('../package.json', import.meta.url)));
const publicDir = path.join(root, 'public');

const OG_TEXT = {
  site: 'shogo.jp',
  placeholder: 'Shogo について検索',
  lead: '作ったものと、書いたものについて答えるサイト',
};

/* src/styles/global.css のライトテーマのトークンと同じ値にすること */
const COLOR = {
  bg: '#ffffff',
  fg: '#202124',
  dim: '#5f6368',
  accent: '#0b57d0',
  border: '#dadce0',
};

const FONT =
  '-apple-system, BlinkMacSystemFont, Segoe UI, Helvetica Neue, Hiragino Sans, Yu Gothic, sans-serif';

/* トップページそのままの絵にする。何ができるサイトなのかが1枚で分かる */
const ogSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="${COLOR.bg}"/>

  <text x="600" y="248" text-anchor="middle" font-family="${FONT}" font-size="86" font-weight="500" fill="${COLOR.fg}"
    >shogo<tspan fill="${COLOR.accent}">.</tspan>jp</text>

  <g>
    <rect x="270" y="316" width="660" height="86" rx="43" fill="${COLOR.bg}" stroke="${COLOR.border}" stroke-width="2"/>
    <g fill="none" stroke="${COLOR.dim}" stroke-width="3.4" stroke-linecap="round">
      <circle cx="326" cy="357" r="13"/>
      <line x1="336" y1="367" x2="346" y2="377"/>
    </g>
    <text x="374" y="370" font-family="${FONT}" font-size="30" fill="${COLOR.dim}">${OG_TEXT.placeholder}</text>
    <rect x="800" y="336" width="110" height="46" rx="23" fill="#f1f3f4"/>
    <text x="855" y="366" text-anchor="middle" font-family="${FONT}" font-size="24" fill="${COLOR.fg}">検索</text>
  </g>

  <text x="600" y="472" text-anchor="middle" font-family="${FONT}" font-size="28" fill="${COLOR.dim}">${OG_TEXT.lead}</text>
</svg>`;

await mkdir(publicDir, { recursive: true });

const favicon = await readFile(path.join(publicDir, 'favicon.svg'));
await sharp(favicon, { density: 384 }).resize(32, 32).png().toFile(path.join(publicDir, 'favicon.png'));
await sharp(favicon, { density: 384 }).resize(180, 180).png().toFile(path.join(publicDir, 'apple-touch-icon.png'));

await writeFile(path.join(root, 'scripts', 'og.svg'), ogSvg); // 確認用（公開はしない）
await sharp(Buffer.from(ogSvg)).png().toFile(path.join(publicDir, 'og.png'));

console.log('generated: favicon.png / apple-touch-icon.png / og.png');
