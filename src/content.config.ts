import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const blog = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/blog' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    pubDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    tags: z.array(z.string()).default([]),
    /** true の記事は一覧・RSS・ビルド対象から除外される */
    draft: z.boolean().default(false),
  }),
});

const works = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/works' }),
  schema: z.object({
    title: z.string(),
    summary: z.string(),
    /** 使っている技術。works 一覧にバッジで並ぶ */
    stack: z.array(z.string()).default([]),
    repo: z.url().optional(),
    url: z.url().optional(),
    year: z.number(),
    /** 一覧の並び順（大きいほど上）。同値なら year の降順 */
    order: z.number().default(0),
    draft: z.boolean().default(false),
  }),
});

export const collections = { blog, works };
