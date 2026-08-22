import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { SITE } from '../consts';
import { getPosts } from '../lib/content';

export async function GET(context: APIContext) {
  if (!context.site) {
    throw new Error('astro.config.mjs の `site` を設定してください（RSS の絶対URLに必要です）');
  }

  const posts = (await getPosts()).filter((post) => !post.data.draft);

  return rss({
    title: SITE.name,
    description: SITE.description,
    site: context.site,
    trailingSlash: true,
    items: posts.map((post) => ({
      title: post.data.title,
      description: post.data.description,
      pubDate: post.data.pubDate,
      link: `/blog/${post.id}/`,
      categories: [...post.data.tags],
    })),
    customData: `<language>${SITE.lang}</language>`,
  });
}
