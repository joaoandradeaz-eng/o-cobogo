import type { APIRoute } from 'astro';
import { getSession, isAuthorized } from '../../../lib/session';
import { slugify } from '../../../lib/slug';
import { createFile, fileExists } from '../../../lib/github';

const VALID_PIECES = ['grade', 'circulos', 'labirinto', 'flor', 'octogonos', 'estrelas', 'barroca'];
const HEX_RE = /^#[0-9a-f]{3}$|^#[0-9a-f]{6}$/i;

export const POST: APIRoute = async ({ request, cookies }) => {
  const session = await getSession(cookies);
  if (!isAuthorized(session)) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 });
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'invalid json' }), { status: 400 });
  }

  const name = String(body.name ?? '').trim();
  if (!name) return new Response(JSON.stringify({ error: 'name required' }), { status: 400 });

  const slug = slugify(body.slug ? String(body.slug) : name);
  if (!slug) return new Response(JSON.stringify({ error: 'could not derive slug from name' }), { status: 400 });

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

  const path = `src/content/tags/${slug}.json`;
  if (await fileExists(path)) {
    return new Response(JSON.stringify({ error: `Já existe uma tag com slug "${slug}"` }), { status: 409 });
  }

  const tagData = { name, color, textColor, parent, description, piece, order };
  const content = JSON.stringify(tagData, null, 2) + '\n';

  try {
    await createFile(path, content, `tag: criar "${name}"`);
    return new Response(JSON.stringify({ ok: true, slug }), {
      status: 201,
      headers: { 'content-type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: `GitHub falhou: ${err.message ?? String(err)}` }),
      { status: 502 }
    );
  }
};
