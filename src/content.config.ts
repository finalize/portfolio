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

const log = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/log' }),
  schema: z.object({
    /** ファイル名（YYYY-MM-DD）と同じ日付。JST 基準 */
    date: z.coerce.date(),
    /** ok = 点検のみ異常なし / changed = 直した / reported = 直さず issue にした */
    status: z.enum(['ok', 'changed', 'reported']),
    /** 一覧に1行で出る要約 */
    summary: z.string(),
    /** 関連する PR / issue の番号 */
    pr: z.number().optional(),
    issue: z.number().optional(),
  }),
});

export const collections = { blog, works, log };
