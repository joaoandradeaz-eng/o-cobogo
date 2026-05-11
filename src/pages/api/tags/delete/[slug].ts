import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { getSession, isAuthorized } from '../../../../lib/session';
import { getFile, deleteFile } from '../../../../lib/github';

export const POST: APIRoute = async ({ cookies, params }) => {
  const session = await getSession(cookies);
  if (!isAuthorized(session)) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 });
  }

  const slug = String(params.slug ?? '').trim();
  if (!slug) {
    return new Response(JSON.stringify({ error: 'slug missing in url' }), { status: 400 });
  }

  // Bloqueia delete se outras tags têm essa como parent
  const tags = await getCollection('tags');
  const childTags = tags.filter((t) => t.data.parent === slug);
  if (childTags.length > 0) {
    return new Response(
      JSON.stringify({
        error: 'has_children',
        children: childTags.map((t) => ({ id: t.id, name: t.data.name })),
        count: childTags.length,
      }),
      { status: 409, headers: { 'content-type': 'application/json' } }
    );
  }

  // Bloqueia delete se artigos usam essa tag
  const articles = await getCollection('articles');
  const affected = articles.filter((a) => a.data.categories.includes(slug));
  if (affected.length > 0) {
    return new Response(
      JSON.stringify({
        error: 'in_use',
        affected: affected.map((a) => ({ id: a.id, title: a.data.title })),
        count: affected.length,
      }),
      { status: 409, headers: { 'content-type': 'application/json' } }
    );
  }

  const path = `src/content/tags/${slug}.json`;
  const file = await getFile(path);
  if (!file) {
    return new Response(JSON.stringify({ error: `Tag "${slug}" não encontrada` }), { status: 404 });
  }

  try {
    await deleteFile(path, file.sha, `tag: deletar "${slug}"`);
    return new Response(JSON.stringify({ ok: true, slug }), {
      headers: { 'content-type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message ?? String(err) }), { status: 502 });
  }
};
