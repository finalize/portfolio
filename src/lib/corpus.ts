/**
 * LLM に渡す事実集合を、このリポジトリの中身だけから組み立てる。
 *
 * 事実の出どころは works / blog / facts / consts.ts の4つだけ。
 * ここに無いことは「書いていない」ものとして扱う。手で事実を足さないこと。
 *
 * 記事の本文は入れない（長い上に、詳細は記事そのものを読ませたい）。
 * 見出しだけを入れて、何が書いてあるかは分かるようにしてある。
 */
import { getCollection } from 'astro:content';
import { NAV, SITE, SOCIALS } from '../consts';

export type Corpus = {
  /** 系統プロンプトに埋める本文 */
  text: string;
  /** 中身が変わるとキャッシュが無効になるよう、本文から作る短いハッシュ */
  hash: string;
  /** LLM が出力してよいリンク先。ここに無い URL はリンクにしない */
  allowedHrefs: ReadonlySet<string>;
};

export async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** 質問文のゆらぎを吸収してキャッシュに当てる。全角/半角・空白・語尾の記号を均す */
export function normalizeQuestion(question: string): string {
  return question
    .normalize('NFKC')
    .toLowerCase()
    .replace(/\s+/gu, ' ')
    .replace(/[。．.、,！!？?ｰ~〜\s]+$/u, '')
    .trim();
}

/** 本文から見出し行だけを抜く */
function headings(body: string): string[] {
  return body
    .split('\n')
    .map((line) => /^#{2,4}\s+(.+?)\s*$/.exec(line)?.[1])
    .filter((heading): heading is string => Boolean(heading));
}

function bullet(label: string, value: string | undefined): string {
  return value ? `- ${label}: ${value}\n` : '';
}

let cached: Corpus | undefined;

/**
 * 事実集合を組み立てる。同じ isolate の中では使い回す
 * （中身はビルド時に確定していて、リクエストごとには変わらない）。
 */
export async function getCorpus(): Promise<Corpus> {
  if (cached) return cached;

  const [facts, works, posts, logs] = await Promise.all([
    getCollection('facts'),
    getCollection('works', ({ data }) => !data.draft),
    getCollection('blog', ({ data }) => !data.draft),
    getCollection('log'),
  ]);

  const allowedHrefs = new Set<string>(['/', '/rss.xml']);
  for (const item of NAV) allowedHrefs.add(`${item.href}/`);
  for (const social of SOCIALS) allowedHrefs.add(social.href);

  const parts: string[] = [];

  parts.push(
    [
      '## サイトの基本',
      '',
      `- 表示名: ${SITE.displayName}`,
      `- 肩書き: ${SITE.role}`,
      `- サイト名: ${SITE.name}`,
      `- サイトの説明: ${SITE.description}`,
      '',
      '連絡先（本人が公開すると決めた値。これ以外の連絡先は存在しない）:',
      ...SOCIALS.map((social) => `- ${social.label}: ${social.value} → ${social.href}`),
      '',
      'このサイトのページ:',
      '- / — ホーム',
      ...NAV.map((item) => `- ${item.href}/`),
    ].join('\n'),
  );

  for (const entry of [...facts].sort((a, b) => b.data.priority - a.data.priority)) {
    parts.push(`## ${entry.data.title}\n\n${entry.body?.trim() ?? ''}`);
  }

  const sortedWorks = [...works].sort(
    (a, b) => b.data.order - a.data.order || b.data.year - a.data.year,
  );
  const workParts: string[] = ['## 制作物（works/）', ''];
  for (const work of sortedWorks) {
    const href = `/works/${work.id}/`;
    allowedHrefs.add(href);
    if (work.data.repo) allowedHrefs.add(work.data.repo);
    if (work.data.url) allowedHrefs.add(work.data.url);

    workParts.push(
      `### ${work.data.title}（${href}）\n` +
        bullet('概要', work.data.summary) +
        bullet('年', String(work.data.year)) +
        bullet('技術', work.data.stack.join(', ')) +
        bullet('リポジトリ', work.data.repo) +
        bullet('公開URL', work.data.url) +
        `\n${work.body?.trim() ?? ''}`,
    );
  }
  parts.push(workParts.join('\n'));

  const sortedPosts = [...posts].sort(
    (a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf(),
  );
  const postParts: string[] = [
    '## 記事（blog/）',
    '',
    '本文は含めていない。詳しく知りたい人には記事の URL を案内する。',
    '',
  ];
  for (const post of sortedPosts) {
    const href = `/blog/${post.id}/`;
    allowedHrefs.add(href);
    for (const tag of post.data.tags) allowedHrefs.add(`/blog/tags/${tag}/`);

    postParts.push(
      `### ${post.data.title}（${href}）\n` +
        bullet('公開日', post.data.pubDate.toISOString().slice(0, 10)) +
        bullet('説明', post.data.description) +
        bullet('タグ', post.data.tags.join(', ')) +
        bullet('見出し', headings(post.body ?? '').join(' / ')),
    );
  }
  parts.push(postParts.join('\n'));

  const sortedLogs = [...logs].sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf());
  const changed = sortedLogs.filter((entry) => entry.data.status === 'changed').length;
  parts.push(
    [
      '## 整備ログ（/log/）',
      '',
      `サイトを毎日 Claude が点検した記録が ${sortedLogs.length} 件ある（うち実際に直したのは ${changed} 件）。`,
      '個別の日付まで聞かれたら /log/ を案内する。直近の要約:',
      '',
      ...sortedLogs
        .slice(0, 5)
        .map(
          (entry) =>
            `- ${entry.data.date.toISOString().slice(0, 10)} [${entry.data.status}] ${entry.data.summary}`,
        ),
    ].join('\n'),
  );

  const text = parts.join('\n\n---\n\n');
  cached = { text, hash: (await sha256Hex(text)).slice(0, 16), allowedHrefs };
  return cached;
}
