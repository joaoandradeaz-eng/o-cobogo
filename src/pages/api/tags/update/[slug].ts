import type { APIRoute } from 'astro';
import matter from 'gray-matter';
import { getCollection } from 'astro:content';
import { getSession, isAuthorized } from '../../../../lib/session';
import { slugify } from '../../../../lib/slug';
import { getFile, multiFileCommit, updateFile, fileExists } from '../../../../lib/github';

const VALID_PIECES = ['grade', 'circulos', 'labirinto', 'flor', 'octogonos', 'estrelas', 'barroca'];
const HEX_RE = /^#[0-9a-f]{3}$|^#[0-9a-f]{6}$/i;

export const POST: APIRoute = async ({ request, cookies, params }) => {
  const session = await getSession(cookies);
  if (!isAuthorized(session)) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 });
  }

  const oldSlug = String(params.slug ?? '').trim();
  if (!oldSlug) {
    return new Response(JSON.stringify({ error: 'slug missing in url' }), { status: 400 });
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'invalid json' }), { status: 400 });
  }

  const name = String(body.name ?? '').trim();
  if (!name) return new Response(JSON.stringify({ error: 'name required' }), { status: 400 });

  const desiredSlug = slugify(body.slug ? String(body.slug) : name);
  if (!desiredSlug) {
    return new Response(JSON.stringify({ error: 'could not derive slug' }), { status: 400 });
  }

  const color = String(body.color ?? '').trim();
  if (!HEX_RE.test(color)) {
    return new Response(JSON.stringify({ error: 'invalid color (use #RRGGBB)' }), { status: 400 });
  }
  const textColor = String(body.textColor ?? '').trim();
  if (!HEX_RE.test(textColor)) {
    return new Response(JSON.stringify({ error: 'invalid textColor (use #RRGGBB)' }), { status: 400 });
  }

  const parent = body.parent && String(body.parent).trim() ? String(body.parent).trim() : null;
  const description = String(body.description ?? '');
  const piece = VALID_PIECES.includes(body.piece) ? body.piece : 'grade';
  const order = Number.isFinite(body.order) ? Number(body.order) : 100;
  const forceRebadge = body.forceRebadge === true;

  // Parent não pode ser ela mesma nem o desiredSlug (se renomeou)
  if (parent === oldSlug || parent === desiredSlug) {
    return new Response(JSON.stringify({ error: 'parent não pode ser a própria tag' }), { status: 400 });
  }

  const oldPath = `src/content/tags/${oldSlug}.json`;
  const newPath = `src/content/tags/${desiredSlug}.json`;

  // Confere se a tag antiga existe
  const oldFile = await getFile(oldPath);
  if (!oldFile) {
    return new Response(JSON.stringify({ error: `Tag "${oldSlug}" não encontrada` }), { status: 404 });
  }

  const tagData = { name, color, textColor, parent, description, piece, order };
  const newContent = JSON.stringify(tagData, null, 2) + '\n';

  // ===== Caso 1: slug não mudou — simples update =====
  if (oldSlug === desiredSlug) {
    try {
      await updateFile(oldPath, newContent, oldFile.sha, `tag: atualizar "${name}"`);
      return new Response(JSON.stringify({ ok: true, slug: oldSlug, renamed: false }), {
        headers: { 'content-type': 'application/json' },
      });
    } catch (err: any) {
      return new Response(JSON.stringify({ error: err.message ?? String(err) }), { status: 502 });
    }
  }

  // ===== Caso 2: renomeou — precisa checar colisão + rebadge =====

  if (await fileExists(newPath)) {
    return new Response(
      JSON.stringify({ error: `Já existe outra tag com slug "${desiredSlug}". Escolha outro.` }),
      { status: 409 }
    );
  }

  // Acha artigos que usam o slug antigo (via collection — dados do último build)
  const articles = await getCollection('articles');
  const affected = articles.filter((a) => a.data.categories.includes(oldSlug));

  if (affected.length > 0 && !forceRebadge) {
    return new Response(
      JSON.stringify({
        error: 'rename_requires_rebadge',
        affected: affected.map((a) => ({ id: a.id, title: a.data.title })),
        count: affected.length,
      }),
      { status: 409, headers: { 'content-type': 'application/json' } }
    );
  }

  // Monta a lista de arquivos pro multi-file commit:
  //  - delete tag antigo
  //  - create tag novo
  //  - rebadge cada artigo afetado
  const files: Array<{ path: string; content?: string; action?: 'upsert' | 'delete' }> = [
    { path: oldPath, action: 'delete' },
    { path: newPath, content: newContent, action: 'upsert' },
  ];

  for (const article of affected) {
    const articlePath = `src/content/articles/${article.id}.md`;
    const articleFile = await getFile(articlePath);
    if (!articleFile) continue;
    const parsed = matter(articleFile.content);
    const newCategories = (parsed.data.categories as string[]).map((c) =>
      c === oldSlug ? desiredSlug : c
    );
    parsed.data.categories = newCategories;
    const rebadged = matter.stringify(parsed.content, parsed.data);
    files.push({ path: articlePath, content: rebadged, action: 'upsert' });
  }

  try {
    const { commitSha } = await multiFileCommit(
      files,
      `tag: renomear "${oldSlug}" → "${desiredSlug}"${affected.length ? ` + rebadge de ${affected.length} artigo(s)` : ''}`
    );
    return new Response(
      JSON.stringify({
        ok: true,
        slug: desiredSlug,
        renamed: true,
        rebadged: affected.length,
        commitSha,
      }),
      { headers: { 'content-type': 'application/json' } }
    );
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message ?? String(err) }), { status: 502 });
  }
};
