import { getCollection, type CollectionEntry } from 'astro:content';

/** 開発中は draft も表示し、本番ビルドでは除外する */
const includeDrafts = import.meta.env.DEV;

export type Post = CollectionEntry<'blog'>;
export type Work = CollectionEntry<'works'>;

/** 公開記事を新しい順で取得 */
export async function getPosts(): Promise<Post[]> {
  const posts = await getCollection('blog', ({ data }) => includeDrafts || !data.draft);
  return posts.sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf());
}

/** 制作物を order 降順 → 年の新しい順で取得 */
export async function getWorks(): Promise<Work[]> {
  const works = await getCollection('works', ({ data }) => includeDrafts || !data.draft);
  return works.sort(
    (a, b) => b.data.order - a.data.order || b.data.year - a.data.year,
  );
}

/** 2026-08-22 形式（タイムゾーンでズレないよう UTC 基準で整形） */
export function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** タグを出現回数の多い順に集計。タグは URL に出るので ASCII 推奨 */
export function collectTags(posts: Post[]): { tag: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const post of posts) {
    for (const tag of post.data.tags) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }
  return [...counts]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
}
