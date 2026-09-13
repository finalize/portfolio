/**
 * sanitizeAnswer() の検査。LLM の出力が画面に出る前に通る唯一の境界なので、
 * ここが緩むと「実在しないページへのリンク」や「創作された事実」が素通りする。
 *
 *   node scripts/check-answer.mts
 *
 * 依存を増やさないため、Node の型ストリップだけで動かしている（テストフレームワークなし）。
 */
import { sanitizeAnswer } from '../src/lib/answer.ts';

const allowed = new Set([
  '/works/termpic/',
  '/blog/astro-personal-site/',
  'https://github.com/finalize',
]);

let failed = 0;
const check = (name: string, cond: boolean, extra?: unknown) => {
  console.log(`${cond ? 'ok  ' : 'FAIL'}  ${name}`);
  if (!cond) {
    failed++;
    if (extra !== undefined) console.log('       ', JSON.stringify(extra));
  }
};

// 1. 素直な入力はそのまま通る
const good = sanitizeAnswer(
  {
    how: 'works/ から1件',
    blocks: [
      { type: 'text', body: 'termpic は画像をターミナルの絵に変える。' },
      {
        type: 'filelist',
        items: [{ meta: '2026', name: 'termpic', desc: 'マス目に落とす', href: '/works/termpic/' }],
      },
      { type: 'links', items: [{ label: 'termpic を見る', href: '/works/termpic/' }] },
    ],
    sources: ['/works/termpic/'],
    suggestions: ['どうやって作った？'],
  },
  allowed,
);
check('正常系がそのまま通る', good.blocks.length === 3 && good.sources.length === 1, good);

// 2. 許可していないリンク先は落ちる
const evil = sanitizeAnswer(
  {
    how: '',
    blocks: [
      { type: 'links', items: [{ label: '罠', href: 'https://evil.example/steal' }] },
      {
        type: 'filelist',
        items: [{ meta: '', name: 'にせ記事', desc: '', href: '/blog/does-not-exist/' }],
      },
      { type: 'kv', rows: [{ key: 'js', value: 'クリック', href: 'javascript:alert(1)' }] },
    ],
    sources: ['https://evil.example/', '/works/termpic/'],
    suggestions: [],
  },
  allowed,
);
check(
  '許可外リンクだけの links ブロックは丸ごと消える',
  !evil.blocks.some((b) => b.type === 'links'),
  evil.blocks,
);
const filelist = evil.blocks.find((b) => b.type === 'filelist');
check(
  '存在しない内部リンクは href が空になる',
  filelist?.type === 'filelist' && filelist.items[0]!.href === '',
  evil.blocks,
);
const kv = evil.blocks.find((b) => b.type === 'kv');
check(
  'javascript: スキームは href が空になる',
  kv?.type === 'kv' && kv.rows[0]!.href === '',
  evil.blocks,
);
check(
  'sources から許可外の URL が落ちる',
  evil.sources.length === 1 && evil.sources[0] === '/works/termpic/',
  evil.sources,
);

// 3. 未知のブロック型・壊れた形は捨てられ、全滅なら notfound に倒れる
const broken = sanitizeAnswer(
  {
    how: 42,
    blocks: [{ type: 'script', src: 'x' }, 'not an object', null, { type: 'text' }],
    sources: 'nope',
    suggestions: 'nope',
  },
  allowed,
);
check(
  '未知の型・壊れた形は捨てられ notfound になる',
  broken.blocks.length === 1 && broken.blocks[0]!.type === 'notfound',
  broken.blocks,
);
check('how が文字列でなければ空文字になる', broken.how === '', broken.how);
check(
  'sources / suggestions が配列でなければ空配列',
  broken.sources.length === 0 && broken.suggestions.length === 0,
  broken,
);

// 4. 長さと個数の上限
const huge = sanitizeAnswer(
  {
    how: 'c'.repeat(500),
    blocks: Array.from({ length: 40 }, () => ({ type: 'text', body: 'あ'.repeat(5000) })),
    sources: Array.from({ length: 40 }, () => '/works/termpic/'),
    suggestions: Array.from({ length: 40 }, (_, i) => `質問${i}`),
  },
  allowed,
);
const firstText = huge.blocks[0]!;
check('blocks は 8 個まで', huge.blocks.length === 8, huge.blocks.length);
check(
  'text は 1200 文字程度まで',
  firstText.type === 'text' && firstText.body.length <= 1201,
  firstText.type === 'text' ? firstText.body.length : firstText.type,
);
check('how は 80 文字程度まで', huge.how.length <= 81, huge.how.length);
check('sources の重複は畳まれる', huge.sources.length === 1, huge.sources);
check('suggestions は 3 件まで', huge.suggestions.length === 3, huge.suggestions);

// 5. 制御文字は落ち、HTML らしき文字列はただの文字として残る（描画側は textContent）
const CONTROL = '\u001b[31m\u0007\u0000';
const html = sanitizeAnswer(
  {
    how: '',
    blocks: [{ type: 'text', body: `<img src=x onerror=alert(1)> ${CONTROL}危険` }],
    sources: [],
    suggestions: [],
  },
  allowed,
);
const htmlBlock = html.blocks[0]!;
const body = htmlBlock.type === 'text' ? htmlBlock.body : '';
check('制御文字は除去される', !/[\u0000-\u0008\u000b-\u001f\u007f]/.test(body), body);
check('タグは文字列のまま残る（描画は textContent なので実行されない）', body.includes('<img'), body);

// 6. table は head の列数に揃う
const table = sanitizeAnswer(
  {
    how: '',
    blocks: [{ type: 'table', head: ['a', 'b', 'c'], rows: [['1'], ['1', '2', '3', '4', '5']] }],
    sources: [],
    suggestions: [],
  },
  allowed,
);
const tableBlock = table.blocks[0]!;
check(
  'table の各行が head の列数に揃う',
  tableBlock.type === 'table' && tableBlock.rows.every((r) => r.length === 3),
  tableBlock.type === 'table' ? tableBlock.rows : tableBlock.type,
);

console.log(failed === 0 ? '\nsanitizeAnswer: すべて通過' : `\nsanitizeAnswer: ${failed} 件失敗`);
process.exit(failed === 0 ? 0 : 1);
