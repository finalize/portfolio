/**
 * favicon / OGP 画像を SVG から生成する。
 *   node scripts/generate-images.mjs
 * 名前や肩書きを変えたら OG_TEXT を直して再実行する（src/consts.ts と揃える）。
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import sharp from 'sharp';

const root = path.dirname(fileURLToPath(new URL('../package.json', import.meta.url)));
const publicDir = path.join(root, 'public');

const OG_TEXT = {
  prompt: '~/shogo',
  command: 'whoami',
  name: 'Shogo',
  role: 'Software Engineer',
  site: 'shogo.jp',
};

const FONT = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';

const ogSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="#0b0e0f"/>
  <g>
    <rect x="80" y="85" width="1040" height="460" rx="18" fill="#131819" stroke="#223028" stroke-width="2"/>
    <path d="M80 103 a18 18 0 0 1 18-18 h1004 a18 18 0 0 1 18 18 v43 h-1040 z" fill="#0f1415"/>
    <line x1="80" y1="146" x2="1120" y2="146" stroke="#223028" stroke-width="2"/>
    <circle cx="114" cy="115" r="7" fill="#ff5f57"/>
    <circle cx="140" cy="115" r="7" fill="#febc2e"/>
    <circle cx="166" cy="115" r="7" fill="#28c840"/>
  </g>
  <g font-family="${FONT}" font-size="30">
    <text x="132" y="232" fill="#7ee787" font-weight="700">${OG_TEXT.prompt}</text>
    <text x="268" y="232" fill="#8b9a93">$</text>
    <text x="300" y="232" fill="#79c0ff">${OG_TEXT.command}</text>
  </g>
  <text x="132" y="336" font-family="${FONT}" font-size="82" font-weight="700" fill="#cfd8d3">${OG_TEXT.name}</text>
  <text x="132" y="392" font-family="${FONT}" font-size="34" fill="#8b9a93">— ${OG_TEXT.role}</text>
  <g font-family="${FONT}" font-size="30">
    <text x="132" y="482" fill="#7ee787" font-weight="700">${OG_TEXT.prompt}</text>
    <text x="268" y="482" fill="#8b9a93">$</text>
    <rect x="300" y="459" width="17" height="30" fill="#7ee787"/>
  </g>
  <text x="1088" y="482" text-anchor="end" font-family="${FONT}" font-size="28" fill="#8b9a93">${OG_TEXT.site}</text>
</svg>`;

await mkdir(publicDir, { recursive: true });

const favicon = await readFile(path.join(publicDir, 'favicon.svg'));
await sharp(favicon, { density: 384 }).resize(32, 32).png().toFile(path.join(publicDir, 'favicon.png'));
await sharp(favicon, { density: 384 }).resize(180, 180).png().toFile(path.join(publicDir, 'apple-touch-icon.png'));

await writeFile(path.join(publicDir, 'og.svg'), ogSvg);
await sharp(Buffer.from(ogSvg)).png().toFile(path.join(publicDir, 'og.png'));

console.log('generated: favicon.png / apple-touch-icon.png / og.png');
