import type { APIRoute } from 'astro';
import { getSession, isAuthorized } from '../../../lib/session';
import { slugify } from '../../../lib/slug';
import { htmlToMarkdown, buildMarkdownFile, type PostFrontmatter } from '../../../lib/markdown';
import { createFile, fileExists } from '../../../lib/github';

const VALID_CATEGORIES = ['ensaio', 'reportagem', 'critica', 'entrevista', 'memoria', 'cidade-casa'];

type CreateBody = {
  title?: string;
  dek?: string;
  categories?: string[];
  date?: string;
  readTime?: string;
  draft?: boolean;
  bodyHtml?: string;
  linhaFina?: string;
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

export const POST: APIRoute = async ({ request, cookies }) => {
  const session = await getSession(cookies);
  if (!isAuthorized(session)) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 });
  }

  let body: CreateBody;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'invalid json' }), { status: 400 });
  }

  const isDraft = body.draft === true;
  const titleRaw = body.title?.trim() ?? '';
  const dekRaw = body.dek?.trim() ?? '';
  const bodyHtmlRaw = body.bodyHtml?.trim() ?? '';

  if (isDraft) {
    if (!titleRaw && !dekRaw && !bodyHtmlRaw) {
      return new Response(
        JSON.stringify({ error: 'preencha pelo menos título, dek ou corpo' }),
        { status: 400 }
      );
    }
  } else {
    const errors: string[] = [];
    if (!titleRaw) errors.push('title is required');
    if (!dekRaw) errors.push('dek is required');
    if (!body.categories?.length) errors.push('at least one category is required');
    if (!bodyHtmlRaw) errors.push('body is empty');
    if (errors.length) {
      return new Response(JSON.stringify({ error: errors.join('; ') }), { status: 400 });
    }
  }

  if (body.categories?.some((c) => !VALID_CATEGORIES.includes(c))) {
    return new Response(JSON.stringify({ error: 'invalid category' }), { status: 400 });
  }

  const titleEffective =
    titleRaw || deriveTitleFromBody(bodyHtmlRaw) || dekRaw || `rascunho-${Date.now()}`;
  const slug = slugify(titleEffective);
  if (!slug) {
    return new Response(JSON.stringify({ error: 'could not derive slug from title' }), { status: 400 });
  }

  const path = `src/content/articles/${slug}.md`;

  if (await fileExists(path)) {
    return new Response(
      JSON.stringify({ error: `Já existe um artigo com slug "${slug}". Mude o título.` }),
      { status: 409 }
    );
  }

  const frontmatter: PostFrontmatter = {
    title: titleEffective,
    dek: dekRaw || '...',
    categories: body.categories?.length ? body.categories : ['ensaio'],
    date: body.date?.trim() || todayISO(),
    readTime: body.readTime?.trim() || '1 min',
    draft: isDraft,
    linhaFina: body.linhaFina?.trim() || undefined,
    notas: body.notas?.length ? body.notas.map((n) => n.trim()).filter(Boolean) : undefined,
  };

  const markdownBody = bodyHtmlRaw ? htmlToMarkdown(bodyHtmlRaw) : '';
  const fileContent = buildMarkdownFile(frontmatter, markdownBody);
  const commitMessage = `post: ${frontmatter.title}${isDraft ? ' (draft)' : ''}`;

  try {
    const result = await createFile(path, fileContent, commitMessage);
    return new Response(
      JSON.stringify({ ok: true, slug, path, commitSha: result.commitSha }),
      { status: 201, headers: { 'content-type': 'application/json' } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: `GitHub commit failed: ${err.message ?? String(err)}` }),
      { status: 502 }
    );
  }
};
