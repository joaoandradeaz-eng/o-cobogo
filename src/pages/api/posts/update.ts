import type { APIRoute } from 'astro';
import { getSession, isAuthorized } from '../../../lib/session';
import { htmlToMarkdown, buildMarkdownFile, type PostFrontmatter } from '../../../lib/markdown';
import { getFile, updateFile } from '../../../lib/github';

const VALID_CATEGORIES = ['ensaio', 'reportagem', 'critica', 'entrevista', 'memoria', 'cidade-casa'];

type UpdateBody = {
  slug?: string;
  title?: string;
  dek?: string;
  categories?: string[];
  date?: string;
  readTime?: string;
  draft?: boolean;
  bodyHtml?: string;
  linhaFina?: string;
  linhaFinaLabel?: string;
  notas?: string[];
};

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export const POST: APIRoute = async ({ request, cookies }) => {
  const session = await getSession(cookies);
  if (!isAuthorized(session)) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 });
  }

  let body: UpdateBody;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'invalid json' }), { status: 400 });
  }

  // O slug é travado na edição — vem do client, nunca é re-derivado do título.
  const slug = body.slug?.trim() ?? '';
  if (!slug) {
    return new Response(JSON.stringify({ error: 'slug ausente' }), { status: 400 });
  }

  const isDraft = body.draft === true;
  const titleRaw = body.title?.trim() ?? '';
  const dekRaw = body.dek?.trim() ?? '';
  const bodyHtmlRaw = body.bodyHtml?.trim() ?? '';

  if (!isDraft) {
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

  const path = `src/content/articles/${slug}.md`;

  let existing: { content: string; sha: string } | null;
  try {
    existing = await getFile(path);
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: `Falha ao ler do GitHub: ${err.message ?? String(err)}` }),
      { status: 502 }
    );
  }
  if (!existing) {
    return new Response(
      JSON.stringify({ error: `Artigo "${slug}" não existe mais no repositório.` }),
      { status: 404 }
    );
  }

  const frontmatter: PostFrontmatter = {
    title: titleRaw || `(sem título) ${slug}`,
    dek: dekRaw || '...',
    categories: body.categories?.length ? body.categories : ['ensaio'],
    date: body.date?.trim() || todayISO(),
    readTime: body.readTime?.trim() || '1 min',
    draft: isDraft,
    linhaFina: body.linhaFina?.trim() || undefined,
    linhaFinaLabel: body.linhaFinaLabel,
    notas: body.notas?.length ? body.notas.map((n) => n.trim()).filter(Boolean) : undefined,
  };

  const markdownBody = bodyHtmlRaw ? htmlToMarkdown(bodyHtmlRaw) : '';
  const fileContent = buildMarkdownFile(frontmatter, markdownBody);
  const commitMessage = `edit: ${frontmatter.title}${isDraft ? ' (draft)' : ''}`;

  try {
    const result = await updateFile(path, fileContent, existing.sha, commitMessage);
    return new Response(
      JSON.stringify({ ok: true, slug, path, commitSha: result.commitSha }),
      { status: 200, headers: { 'content-type': 'application/json' } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: `GitHub commit failed: ${err.message ?? String(err)}` }),
      { status: 502 }
    );
  }
};
