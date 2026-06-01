import type { APIRoute } from 'astro';
import matter from 'gray-matter';
import { getSession, isAuthorized } from '../../../lib/session';
import { getFile, updateFile } from '../../../lib/github';

type ToggleBody = { slug?: string; draft?: boolean };

export const POST: APIRoute = async ({ request, cookies }) => {
  const session = await getSession(cookies);
  if (!isAuthorized(session)) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 });
  }

  let body: ToggleBody;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'invalid json' }), { status: 400 });
  }

  const slug = body.slug?.trim() ?? '';
  if (!slug) {
    return new Response(JSON.stringify({ error: 'slug ausente' }), { status: 400 });
  }
  const makeDraft = body.draft === true;

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
      JSON.stringify({ error: `Artigo "${slug}" não existe.` }),
      { status: 404 }
    );
  }

  // Reescreve só o flag draft, preservando todo o resto do frontmatter e o corpo intactos.
  const parsed = matter(existing.content);
  if (makeDraft) {
    parsed.data.draft = true;
  } else {
    delete parsed.data.draft;
  }
  const newContent = matter.stringify(parsed.content, parsed.data);
  const commitMessage = makeDraft ? `unpublish: ${slug}` : `publish: ${slug}`;

  try {
    const result = await updateFile(path, newContent, existing.sha, commitMessage);
    return new Response(
      JSON.stringify({ ok: true, slug, draft: makeDraft, commitSha: result.commitSha }),
      { status: 200, headers: { 'content-type': 'application/json' } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: `GitHub commit failed: ${err.message ?? String(err)}` }),
      { status: 502 }
    );
  }
};
