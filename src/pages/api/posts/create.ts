import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { getSession, isAuthorized } from '../../../lib/session';
import { slugify } from '../../../lib/slug';
import { htmlToMarkdown, buildMarkdownFile, type PostFrontmatter } from '../../../lib/markdown';
import { estimateReadTime } from '../../../lib/readtime';
import { createFile, fileExists } from '../../../lib/github';

type CreateBody = {
  title?: string;
  dek?: string;
  categories?: string[];
  date?: string;
  readTime?: string;
  draft?: boolean;
  bodyHtml?: string;
  heroImage?: string;
  heroCaption?: string;
  heroPosition?: string;
  heroZoom?: number;
  linhaFina?: string;
  linhaFinaLabel?: string;
  notas?: string[];
};

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function deriveTitleFromBody(html: string): string {
  const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  if (!text) return '';
  const trimmed = text.slice(0, 60);
  return trimmed + (text.length > 60 ? '…' : '');
}

// Toda resposta sai com content-type JSON. Sem isso, uma página de erro da
// plataforma (HTML) chega ao cliente indistinguível de uma resposta legítima.
function json(payload: unknown, status: number): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

export const POST: APIRoute = async ({ request, cookies }) => {
  const session = await getSession(cookies);
  if (!isAuthorized(session)) {
    return json({ error: 'unauthorized' }, 401);
  }

  let body: CreateBody;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'invalid json' }, 400);
  }

  const isDraft = body.draft === true;
  const titleRaw = body.title?.trim() ?? '';
  // '...' era o texto-tapume da época em que o dek era obrigatório; formulários
  // antigos (abas abertas / rascunhos locais) ainda o enviam — trata como vazio.
  const dekTrimmed = body.dek?.trim() ?? '';
  const dekRaw = /^[.…\s]*$/.test(dekTrimmed) ? '' : dekTrimmed;
  const bodyHtmlRaw = body.bodyHtml?.trim() ?? '';

  if (isDraft) {
    if (!titleRaw && !dekRaw && !bodyHtmlRaw) {
      return json({ error: 'preencha pelo menos título, dek ou corpo' }, 400);
    }
  } else {
    const errors: string[] = [];
    if (!titleRaw) errors.push('title is required');
    if (!body.categories?.length) errors.push('at least one category is required');
    if (!bodyHtmlRaw) errors.push('body is empty');
    if (errors.length) {
      return json({ error: errors.join('; ') }, 400);
    }
  }

  // Lê as editorias reais do repositório (src/content/tags) — nunca uma lista fixa
  // que pode desencontrar das tags. Assim, criar uma tag nova já a habilita aqui.
  let validCategories: string[];
  try {
    validCategories = (await getCollection('tags')).map((t) => t.id);
  } catch (err: any) {
    return json(
      { error: `Não consegui ler as editorias do repositório. Detalhe: ${err?.message ?? String(err)}` },
      500
    );
  }
  if (body.categories?.some((c) => !validCategories.includes(c))) {
    return json({ error: 'invalid category' }, 400);
  }

  const titleEffective =
    titleRaw || deriveTitleFromBody(bodyHtmlRaw) || dekRaw || `rascunho-${Date.now()}`;
  const slug = slugify(titleEffective);
  if (!slug) {
    return json({ error: 'could not derive slug from title' }, 400);
  }

  const path = `src/content/articles/${slug}.md`;

  // Esta checagem fala com o GitHub. Se o token expirou, ela lança — e, sem este
  // try, a função inteira caía num 500 em HTML, que chegava ao editor como
  // "Unexpected token '<'" e escondia a causa real.
  let jaExiste: boolean;
  try {
    jaExiste = await fileExists(path);
  } catch (err: any) {
    return json(
      {
        error: `Não consegui falar com o GitHub para checar o slug (token expirado ou sem permissão?). Detalhe: ${err?.message ?? String(err)}`,
      },
      502
    );
  }
  if (jaExiste) {
    return json({ error: `Já existe um artigo com slug "${slug}". Mude o título.` }, 409);
  }

  const frontmatter: PostFrontmatter = {
    title: titleEffective,
    dek: dekRaw,
    categories: body.categories?.length ? body.categories : ['opiniao'],
    date: body.date?.trim() || todayISO(),
    readTime: body.readTime?.trim() || estimateReadTime(bodyHtmlRaw),
    draft: isDraft,
    heroImage: body.heroImage?.trim() || undefined,
    heroCaption: body.heroCaption?.trim() || undefined,
    heroPosition: body.heroPosition?.trim() || undefined,
    heroZoom: typeof body.heroZoom === 'number' ? body.heroZoom : undefined,
    linhaFina: body.linhaFina?.trim() || undefined,
    linhaFinaLabel: body.linhaFinaLabel,
    notas: body.notas?.length ? body.notas.map((n) => n.trim()).filter(Boolean) : undefined,
  };

  const markdownBody = bodyHtmlRaw ? htmlToMarkdown(bodyHtmlRaw) : '';
  const fileContent = buildMarkdownFile(frontmatter, markdownBody);
  const commitMessage = `post: ${frontmatter.title}${isDraft ? ' (draft)' : ''}`;

  try {
    const result = await createFile(path, fileContent, commitMessage);
    return json({ ok: true, slug, path, commitSha: result.commitSha }, 201);
  } catch (err: any) {
    return json(
      { error: `Falha ao salvar no GitHub (token expirado ou sem permissão?). Detalhe: ${err?.message ?? String(err)}` },
      502
    );
  }
};
