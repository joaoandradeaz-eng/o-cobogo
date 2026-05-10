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

/* Preserve <mark> for hand-drawn highlight. */
turndown.addRule('highlight', {
  filter: ['mark'],
  replacement: (content) => `<mark>${content}</mark>`,
});

/* Preserve <span style="color:..."> from Color extension. */
turndown.addRule('coloredSpan', {
  filter: (node: any) =>
    node.nodeName === 'SPAN' &&
    typeof node.getAttribute === 'function' &&
    !!node.getAttribute('style'),
  replacement: (content, node: any) =>
    `<span style="${node.getAttribute('style')}">${content}</span>`,
});

/* Preserve <p style="text-align:..."> from TextAlign extension.
   Block HTML in markdown — needs blank lines around it. */
turndown.addRule('alignedParagraph', {
  filter: (node: any) =>
    node.nodeName === 'P' &&
    typeof node.getAttribute === 'function' &&
    (node.getAttribute('style') || '').includes('text-align'),
  replacement: (content, node: any) =>
    `\n\n<p style="${node.getAttribute('style')}">${content}</p>\n\n`,
});

/* Same for h2/h3 with text-align (TextAlign extension applies to headings too). */
turndown.addRule('alignedHeading', {
  filter: (node: any) =>
    /^H[2-3]$/.test(node.nodeName) &&
    typeof node.getAttribute === 'function' &&
    (node.getAttribute('style') || '').includes('text-align'),
  replacement: (content, node: any) => {
    const tag = node.nodeName.toLowerCase();
    return `\n\n<${tag} style="${node.getAttribute('style')}">${content}</${tag}>\n\n`;
  },
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
