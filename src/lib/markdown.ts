import TurndownService from 'turndown';
import matter from 'gray-matter';
import { marked } from 'marked';

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
  heroPosition?: string;
  heroZoom?: number;
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

/* Preserve <table> COMPLETA como raw HTML — markdown padrão não suporta
   cell colors, alinhamento custom, bordas variadas. Block-level. */
turndown.addRule('table', {
  filter: ['table'],
  replacement: (_, node: any) => {
    const html = (node as HTMLElement).outerHTML;
    return `\n\n${html}\n\n`;
  },
});

/* Preserve <div data-chart> com SVG/HTML inline — gráficos hand-crafted.
   outerHTML mantém SVG, classes, atributos. Block-level. */
turndown.addRule('chart', {
  filter: (node: any) =>
    node.nodeName === 'DIV' &&
    typeof node.getAttribute === 'function' &&
    node.hasAttribute('data-chart'),
  replacement: (_, node: any) => {
    const html = (node as HTMLElement).outerHTML;
    return `\n\n${html}\n\n`;
  },
});

/* Preserve <img> com posição (img-pos-center/left/right/full) + width inline.
   Sempre emite raw HTML em vez de markdown ![alt](src) pra manter
   data-position, class e style="width:X%". Block-level (\n\n volta). */
turndown.addRule('positionedImage', {
  filter: 'img',
  replacement: (_, node: any) => {
    const src = node.getAttribute('src') ?? '';
    const alt = (node.getAttribute('alt') ?? '').replace(/"/g, '&quot;');
    const pos = node.getAttribute('data-position') ?? 'center';
    const style = node.getAttribute('style') ?? '';
    const styleAttr = style ? ` style="${style}"` : '';
    return `\n\n<img src="${src}" alt="${alt}" data-position="${pos}" class="img-pos-${pos}"${styleAttr} />\n\n`;
  },
});

export function htmlToMarkdown(html: string): string {
  return turndown.turndown(html).trim();
}

/* Markdown → HTML para pré-preencher o editor TipTap na edição.
   marked converte os pedaços markdown (parágrafos, *itálico*, ## títulos, listas)
   e deixa passar o HTML cru embutido (blockquote, figure, table, charts, img posicionada). */
export function markdownToHtml(md: string): string {
  return marked.parse(md, { async: false, gfm: true, breaks: false }) as string;
}

export function buildMarkdownFile(frontmatter: PostFrontmatter, body: string): string {
  const data: Record<string, unknown> = {
    title: frontmatter.title,
    categories: frontmatter.categories,
    author: frontmatter.author ?? 'João Andrade',
    date: new Date(`${frontmatter.date}T00:00:00Z`),
    readTime: frontmatter.readTime,
  };
  // Dek é opcional: vazio não entra no frontmatter (e a página não renderiza o <p>).
  if (frontmatter.dek?.trim()) data.dek = frontmatter.dek;
  if (frontmatter.heroImage) data.heroImage = frontmatter.heroImage;
  if (frontmatter.heroCaption) data.heroCaption = frontmatter.heroCaption;
  // Enquadramento só importa se há capa; grava apenas valores fora do padrão.
  if (frontmatter.heroImage) {
    if (frontmatter.heroPosition && frontmatter.heroPosition !== '50% 50%') {
      data.heroPosition = frontmatter.heroPosition;
    }
    if (frontmatter.heroZoom && frontmatter.heroZoom !== 1) {
      data.heroZoom = frontmatter.heroZoom;
    }
  }
  if (frontmatter.linhaFina) data.linhaFina = frontmatter.linhaFina;
  if (frontmatter.linhaFinaLabel !== undefined) data.linhaFinaLabel = frontmatter.linhaFinaLabel;
  if (frontmatter.notas?.length) data.notas = frontmatter.notas;
  if (frontmatter.draft) data.draft = true;
  return matter.stringify(body + '\n', data);
}
