import type { APIRoute } from 'astro';
import { getSession, isAuthorized } from '../../../lib/session';
import { getFile, deleteFile } from '../../../lib/github';

type DeleteBody = { slug?: string };

export const POST: APIRoute = async ({ request, cookies }) => {
  const session = await getSession(cookies);
  if (!isAuthorized(session)) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 });
  }

  let body: DeleteBody;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'invalid json' }), { status: 400 });
  }

  const slug = body.slug?.trim() ?? '';
  if (!slug) {
    return new Response(JSON.stringify({ error: 'slug ausente' }), { status: 400 });
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
      JSON.stringify({ error: `Artigo "${slug}" já não existe.` }),
      { status: 404 }
    );
  }

  try {
    const result = await deleteFile(path, existing.sha, `delete: ${slug}`);
    return new Response(
      JSON.stringify({ ok: true, slug, commitSha: result.commitSha }),
      { status: 200, headers: { 'content-type': 'application/json' } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: `GitHub delete failed: ${err.message ?? String(err)}` }),
      { status: 502 }
    );
  }
};
