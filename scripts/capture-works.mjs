/**
 * works のサムネイル元画像を用意する。
 *   node scripts/capture-works.mjs            すべて
 *   node scripts/capture-works.mjs contrast-kit   1件だけ
 *
 * 出力は src/assets/works/<id>.png。これは公開されない。
 * ビルド時に <TermPic> がマス目に落とし、その結果だけが HTML に入る。
 *
 * ブラウザは pnpm dlx で借りるので、このリポジトリに playwright は入れていない
 * （CI では使わず、サイトの見た目が変わったときに手で流すだけのスクリプト）。
 *
 * 元画像の選び方が結果を決める。マス目に落とすと細かい文字は全部つぶれるので、
 * 大きくて平らで色の差がはっきりした構図でないと、ただの灰色の面になる。
 * ページ全体のスクリーンショットはまず失敗する。
 */
import { execFile } from 'node:child_process';
import { mkdir, readFile, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import path from 'node:path';
import sharp from 'sharp';

const run = promisify(execFile);
const root = path.dirname(fileURLToPath(new URL('../package.json', import.meta.url)));
const outDir = path.join(root, 'src/assets/works');
const tmpDir = path.join(root, 'node_modules/.cache/work-shots');

const PLAYWRIGHT = 'playwright@1.62.1';
/** ライト/ダークで結果が変わらないよう、撮影条件は固定する */
const VIEWPORT = '1280,900';

const SOURCES = {
  // og.png は端末ウィンドウを大きく描いたカード画像。
  // 実際のスクリーンショットより、マス目に落としたときによく残る。
  'shogo-site': { file: 'public/og.png' },

  // hidori も同じ理由で OGP 画像を使う。実物の画面は白地に細い記号なので、
  // トップ・出欠表・その一部と3通り試して全部ただの灰色の面になった。
  hidori: { url: 'https://hidori.shgysd.workers.dev/og.png', image: true },

  // プレビューに出ている変換結果そのもの。太い輪と黒の2値に近いので、
  // もう一度マス目に落としても崩れない。上の入力欄と設定欄の高さは固定なので位置も動かない。
  termpic: {
    url: 'https://termpic.shgysd.workers.dev',
    crop: () => ({ left: 192, top: 677, width: 582, height: 585 }),
  },

  // 全組み合わせの表は色のブロックの集まりなので、量子化してもほぼそのまま残る。
  // 表はフッターの手前＝ページ末尾なので、上からではなく下端から測る（追記に強い）。
  'contrast-kit': {
    url: 'https://contrast-kit.shgysd.workers.dev',
    crop: (_width, height) => ({ left: 160, top: height - 510, width: 750, height: 420 }),
  },
};

async function sourceImage(id, source) {
  if (source.file) return readFile(path.join(root, source.file));

  // url が画像そのものを指しているときは、ブラウザを立てずに落とすだけでよい
  if (source.image) {
    const response = await fetch(source.url);
    if (!response.ok) throw new Error(`${id}: ${source.url} が ${response.status} を返しました`);
    return Buffer.from(await response.arrayBuffer());
  }

  const shot = path.join(tmpDir, `${id}.png`);
  await run('pnpm', [
    'dlx', PLAYWRIGHT, 'screenshot',
    '--full-page',
    '--color-scheme=dark',
    `--viewport-size=${VIEWPORT}`,
    '--wait-for-timeout=1500',
    source.url, shot,
  ]);

  const image = sharp(await readFile(shot));
  if (!source.crop) return image.png().toBuffer();

  const { width, height } = await image.metadata();
  const rect = source.crop(width, height);
  console.log(`  ${id}: ${width}x${height} から ${rect.width}x${rect.height} を切り出す（top ${rect.top}）`);
  return image.extract(rect).png().toBuffer();
}

const only = process.argv[2];
const targets = only ? [[only, SOURCES[only]]] : Object.entries(SOURCES);
if (only && !SOURCES[only]) {
  console.error(`${only} の設定がありません。SOURCES: ${Object.keys(SOURCES).join(', ')}`);
  process.exit(1);
}

await mkdir(outDir, { recursive: true });
await mkdir(tmpDir, { recursive: true });

for (const [id, source] of targets) {
  const buffer = await sourceImage(id, source);
  const out = path.join(outDir, `${id}.png`);
  await sharp(buffer).png().toFile(out);
  const { width, height } = await sharp(buffer).metadata();
  console.log(`generated: src/assets/works/${id}.png (${width}x${height})`);
}

await rm(tmpDir, { recursive: true, force: true });
console.log('src/assets/works/<id>.png がある works には自動でサムネイルが付く。');
