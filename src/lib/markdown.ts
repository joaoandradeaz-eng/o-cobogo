import TurndownService from 'turndown';
import matter from 'gray-matter';

export type PostFrontmatter = {
  title: string;
  dek: string;
  categories: string[];
  date: string;
  readTime: string;
  author?: string;
  draft?: boolean;
};

const turndown = new TurndownService({
  headingStyle: 'atx',
  bulletListMarker: '-',
  codeBlockStyle: 'fenced',
  emDelimiter: '*',
  strongDelimiter: '**',
});

export function htmlToMarkdown(html: string): string {
  return turndown.turndown(html).trim();
}

export function buildMarkdownFile(frontmatter: PostFrontmatter, body: string): string {
  const data: Record<string, unknown> = {
    title: frontmatter.title,
    dek: frontmatter.dek,
    categories: frontmatter.categories,
    author: frontmatter.author ?? 'João Andrade',
    date: new Date(`${frontmatter.date}T00:00:00Z`),
    readTime: frontmatter.readTime,
  };
  if (frontmatter.draft) data.draft = true;
  return matter.stringify(body + '\n', data);
}
