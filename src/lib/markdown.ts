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
  linhaFina?: string;
  linhaFinaLabel?: string;
  notas?: string[];
  heroImage?: string;
  heroCaption?: string;
};

const turndown = new TurndownService({
  headingStyle: 'atx',
  bulletListMarker: '-',
  codeBlockStyle: 'fenced',
  emDelimiter: '*',
  strongDelimiter: '**',
});

/* Preserve <sup>N</sup> footnote anchors as raw HTML in markdown so the published view
   can render them clickable. Turndown discards unknown tags by default. */
turndown.addRule('superscript', {
  filter: ['sup'],
  replacement: (content) => `<sup>${content}</sup>`,
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
  if (frontmatter.heroImage) data.heroImage = frontmatter.heroImage;
  if (frontmatter.heroCaption) data.heroCaption = frontmatter.heroCaption;
  if (frontmatter.linhaFina) data.linhaFina = frontmatter.linhaFina;
  if (frontmatter.linhaFinaLabel !== undefined) data.linhaFinaLabel = frontmatter.linhaFinaLabel;
  if (frontmatter.notas?.length) data.notas = frontmatter.notas;
  if (frontmatter.draft) data.draft = true;
  return matter.stringify(body + '\n', data);
}
