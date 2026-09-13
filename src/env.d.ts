/// <reference types="astro/client" />

/**
 * Worker のバインディングの型。
 *
 * `wrangler types` が生成する worker-configuration.d.ts は使っていない。
 * あれは workerd のランタイム型をグローバルに撒くので、同じ tsconfig で
 * 型検査しているクライアント側スクリプト（<script> の中）の DOM 型と衝突し、
 * document.createElement(...).append(...) の型が壊れる。
 *
 * そのかわり、実際に使うものだけをここに書く。増やすときは
 * https://developers.cloudflare.com/workers/runtime-apis/ を見て合わせること。
 */

/** KV の、このサイトで使っている部分だけ */
interface AskKVNamespace {
  get(key: string): Promise<string | null>;
  get<T>(key: string, type: 'json'): Promise<T | null>;
  put(
    key: string,
    value: string,
    options?: { expirationTtl?: number; expiration?: number },
  ): Promise<void>;
}

/** レート制限バインディング */
interface AskRateLimit {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

/** waitUntil だけ使う */
interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

/**
 * wrangler.jsonc のバインディングとシークレット。
 * どれも optional にしてあるのは、バインディングが無い環境
 * （astro dev、KV 未作成のプレビュー）でも動くようにするため。
 */
interface Env {
  /** 質問 → 回答のキャッシュ */
  ANSWERS?: AskKVNamespace;
  /** IP 単位のレート制限 */
  ASK_LIMIT?: AskRateLimit;
  /** ローカルは .dev.vars、本番は `wrangler secret put ANTHROPIC_API_KEY` */
  ANTHROPIC_API_KEY?: string;
}

declare namespace Cloudflare {
  interface Env {
    ANSWERS?: AskKVNamespace;
    ASK_LIMIT?: AskRateLimit;
    ANTHROPIC_API_KEY?: string;
  }
}

declare module 'cloudflare:workers' {
  export const env: Env;
}

declare namespace App {
  interface Locals {
    /** Cloudflare アダプタが入れる。waitUntil で返事を待たせずに書き込む */
    cfContext?: ExecutionContext;
  }
}
