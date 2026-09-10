/**
 * LLM の回答の型・スキーマ・検証。
 *
 * LLM に HTML を書かせない。既存のターミナル風パーツのどれを、どの順で、
 * どの中身で置くかだけを選ばせる。ここを通っていない値は画面に出ない。
 *
 * サーバ側のこの検証が唯一の境界で、系統プロンプトは境界ではない。
 * リンク先は allowedHrefs（実在するページと consts.ts の外部リンクだけ）に
 * 載っていなければ捨てる。
 */

export type FileRow = {
  /** 左の列。年や日付。無ければ空文字 */
  meta: string;
  name: string;
  /** 名前の下の一行説明。無ければ空文字 */
  desc: string;
  /** 無ければ空文字 */
  href: string;
};

export type KvRow = { key: string; value: string; href: string };

export type Block =
  | { type: 'text'; body: string }
  | { type: 'filelist'; items: FileRow[] }
  | { type: 'kv'; rows: KvRow[] }
  | { type: 'table'; head: string[]; rows: string[][] }
  | { type: 'links'; items: { label: string; href: string }[] }
  | { type: 'notfound'; message: string };

export type Answer = {
  /** 「どう探したか」の一行。検索結果の上に小さく出る。無ければ空文字 */
  how: string;
  blocks: Block[];
  /** 根拠にしたページの URL。allowedHrefs に載っているものだけ */
  sources: string[];
  /** 次に聞けそうな質問 */
  suggestions: string[];
};

const MAX = {
  how: 80,
  text: 1200,
  items: 12,
  tableRows: 20,
  tableCols: 6,
  cell: 160,
  blocks: 8,
  sources: 8,
  suggestions: 3,
  suggestion: 60,
  label: 160,
} as const;

/** LLM に渡す JSON Schema。output_config.format にそのまま入る */
export const ANSWER_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['how', 'blocks', 'sources', 'suggestions'],
  properties: {
    how: {
      type: 'string',
      description:
        'この回答をどこから組み立てたかを表す短い一行。検索結果の件数表示の位置に小さく出る。例: works/ と blog/ から4件。分からなければ空文字。',
    },
    blocks: {
      type: 'array',
      description:
        '上から順に描画されるブロック。1〜4個に収める。同じ内容を text と表で二度言わない。',
      items: {
        anyOf: [
          {
            type: 'object',
            additionalProperties: false,
            required: ['type', 'body'],
            properties: {
              type: { type: 'string', const: 'text' },
              body: {
                type: 'string',
                description:
                  '本文の段落。Markdown は解釈されないのでプレーンテキストで書く。改行で段落を分けてよい。',
              },
            },
          },
          {
            type: 'object',
            additionalProperties: false,
            required: ['type', 'items'],
            description: '検索結果のような一覧。制作物や記事を並べるときに使う。',
            properties: {
              type: { type: 'string', const: 'filelist' },
              items: {
                type: 'array',
                items: {
                  type: 'object',
                  additionalProperties: false,
                  required: ['meta', 'name', 'desc', 'href'],
                  properties: {
                    meta: { type: 'string', description: '左端の列。年や日付。無ければ空文字' },
                    name: { type: 'string', description: '項目名' },
                    desc: { type: 'string', description: '一行説明。無ければ空文字' },
                    href: {
                      type: 'string',
                      description: 'このサイト内のページの URL。実在するものだけ。無ければ空文字',
                    },
                  },
                },
              },
            },
          },
          {
            type: 'object',
            additionalProperties: false,
            required: ['type', 'rows'],
            description: '短い項目名と値の組。連絡先や設定値のような対に使う。',
            properties: {
              type: { type: 'string', const: 'kv' },
              rows: {
                type: 'array',
                items: {
                  type: 'object',
                  additionalProperties: false,
                  required: ['key', 'value', 'href'],
                  properties: {
                    key: { type: 'string' },
                    value: { type: 'string' },
                    href: { type: 'string', description: '無ければ空文字' },
                  },
                },
              },
            },
          },
          {
            type: 'object',
            additionalProperties: false,
            required: ['type', 'head', 'rows'],
            description: '2次元の比較。列は4つまでに収める。',
            properties: {
              type: { type: 'string', const: 'table' },
              head: { type: 'array', items: { type: 'string' } },
              rows: {
                type: 'array',
                items: { type: 'array', items: { type: 'string' } },
              },
            },
          },
          {
            type: 'object',
            additionalProperties: false,
            required: ['type', 'items'],
            description: '関連ページへの導線。回答の最後に置く。',
            properties: {
              type: { type: 'string', const: 'links' },
              items: {
                type: 'array',
                items: {
                  type: 'object',
                  additionalProperties: false,
                  required: ['label', 'href'],
                  properties: {
                    label: { type: 'string' },
                    href: { type: 'string' },
                  },
                },
              },
            },
          },
          {
            type: 'object',
            additionalProperties: false,
            required: ['type', 'message'],
            description:
              '事実集合に答えが無いときに使う唯一のブロック。埋め合わせの推測を書かない。',
            properties: {
              type: { type: 'string', const: 'notfound' },
              message: {
                type: 'string',
                description:
                  '何が書かれていないのかを一言で。例: 職歴はこのサイトに書かれていない',
              },
            },
          },
        ],
      },
    },
    sources: {
      type: 'array',
      description: '根拠にしたこのサイトのページの URL。無ければ空配列。',
      items: { type: 'string' },
    },
    suggestions: {
      type: 'array',
      description: '続けて聞けそうな質問を最大3件。短い日本語の疑問文。',
      items: { type: 'string' },
    },
  },
} as const;

/** 制御文字を落として長さを詰める。文字列でなければ空文字 */
function str(value: unknown, max: number): string {
  if (typeof value !== 'string') return '';
  const cleaned = value.replace(/[\x00-\x08\x0b-\x1f\x7f]/g, '').trim();
  return cleaned.length > max ? `${cleaned.slice(0, max)}…` : cleaned;
}

function arr(value: unknown, max: number): unknown[] {
  return Array.isArray(value) ? value.slice(0, max) : [];
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
}

/** allowedHrefs に載っている URL だけを通す。載っていなければリンクにしない */
function href(value: unknown, allowed: ReadonlySet<string>): string {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (!raw) return '';
  return allowed.has(raw) ? raw : '';
}

function toBlock(value: unknown, allowed: ReadonlySet<string>): Block | null {
  const b = asRecord(value);

  switch (b.type) {
    case 'text': {
      const body = str(b.body, MAX.text);
      return body ? { type: 'text', body } : null;
    }
    case 'notfound': {
      const message = str(b.message, MAX.text);
      return message ? { type: 'notfound', message } : null;
    }
    case 'filelist': {
      const items = arr(b.items, MAX.items)
        .map((raw) => {
          const item = asRecord(raw);
          return {
            meta: str(item.meta, 24),
            name: str(item.name, MAX.label),
            desc: str(item.desc, MAX.cell),
            href: href(item.href, allowed),
          };
        })
        .filter((item) => item.name !== '');
      return items.length > 0 ? { type: 'filelist', items } : null;
    }
    case 'kv': {
      const rows = arr(b.rows, MAX.items)
        .map((raw) => {
          const row = asRecord(raw);
          return {
            key: str(row.key, 40),
            value: str(row.value, MAX.cell),
            href: href(row.href, allowed),
          };
        })
        .filter((row) => row.key !== '' && row.value !== '');
      return rows.length > 0 ? { type: 'kv', rows } : null;
    }
    case 'table': {
      const head = arr(b.head, MAX.tableCols).map((cell) => str(cell, 40));
      const width = head.length;
      if (width === 0) return null;
      const rows = arr(b.rows, MAX.tableRows)
        .map((raw) => {
          const cells = arr(raw, width).map((cell) => str(cell, MAX.cell));
          // 列数を head に揃える。足りなければ空セルで埋める
          while (cells.length < width) cells.push('');
          return cells;
        })
        .filter((cells) => cells.some((cell) => cell !== ''));
      return rows.length > 0 ? { type: 'table', head, rows } : null;
    }
    case 'links': {
      const items = arr(b.items, MAX.items)
        .map((raw) => {
          const item = asRecord(raw);
          return { label: str(item.label, MAX.label), href: href(item.href, allowed) };
        })
        // リンク先が実在しないものは出さない
        .filter((item) => item.label !== '' && item.href !== '');
      return items.length > 0 ? { type: 'links', items } : null;
    }
    default:
      return null;
  }
}

/**
 * LLM の生の出力を、画面に出してよい形に落とす。
 * 壊れたブロックは黙って捨て、残りは描く。全部落ちたら notfound に倒す。
 */
export function sanitizeAnswer(value: unknown, allowed: ReadonlySet<string>): Answer {
  const raw = asRecord(value);

  const blocks = arr(raw.blocks, MAX.blocks)
    .map((block) => toBlock(block, allowed))
    .filter((block): block is Block => block !== null);

  return {
    how: str(raw.how, MAX.how),
    blocks:
      blocks.length > 0
        ? blocks
        : [
            {
              type: 'notfound',
              message: 'うまく答えを組み立てられなかった。聞き方を変えてみてほしい。',
            },
          ],
    sources: [
      ...new Set(
        arr(raw.sources, MAX.sources)
          .map((source) => href(source, allowed))
          .filter((source) => source !== ''),
      ),
    ],
    suggestions: arr(raw.suggestions, MAX.suggestions)
      .map((suggestion) => str(suggestion, MAX.suggestion))
      .filter((suggestion) => suggestion !== ''),
  };
}
