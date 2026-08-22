/**
 * サイト全体で使う定数。
 * TODO が付いている値は実際のものに差し替えてください。
 */
export const SITE = {
  /** ターミナルのユーザー名・プロンプトに出る名前 */
  user: 'shogo',
  /** <title> のサフィックスやヘッダーに出るサイト名 */
  name: 'shogo.jp',
  /** トップページの見出しに出る表示名 */
  displayName: 'Shogo',
  /** 肩書き */
  role: 'Software Engineer',
  /** meta description / RSS の説明 */
  description:
    'Shogo の個人サイト。作っているプロダクトと、開発まわりで学んだことを書いています。',
  lang: 'ja',
  locale: 'ja_JP',
} as const;

export type SocialLink = {
  label: string;
  /** ターミナル上の表示（cat contact.txt の出力） */
  value: string;
  href: string;
};

export const SOCIALS: SocialLink[] = [
  {
    label: 'mail',
    value: 'shgysd.work@gmail.com',
    href: 'mailto:shgysd.work@gmail.com',
  },
  {
    label: 'github',
    value: 'github.com/finalize',
    href: 'https://github.com/finalize',
  },
  {
    label: 'x',
    value: 'x.com/finalize',
    href: 'https://x.com/finalize',
  },
];

/** ヘッダーの `ls` 出力として並ぶディレクトリ */
export const NAV = [
  { name: 'about', href: '/about' },
  { name: 'works', href: '/works' },
  { name: 'blog', href: '/blog' },
  { name: 'log', href: '/log' },
  { name: 'contact', href: '/contact' },
] as const;
