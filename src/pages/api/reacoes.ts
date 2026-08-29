import type { APIRoute } from 'astro';
import { lerReacoes, registrarReacao, REACOES, type Reacao } from '../../lib/reacoes';

export const prerender = false;

function json(payload: unknown, status: number, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json', ...extra },
  });
}

function slugValido(v: unknown): v is string {
  return typeof v === 'string' && /^[\w-]{1,80}$/.test(v);
}

// mesmo freio simples por IP do /api/inscrever (reações têm limite mais alto:
// a pessoa pode marcar e desmarcar as três)
const janelas = new Map<string, { ate: number; qtd: number }>();
function estourou(ip: string): boolean {
  const agora = Date.now();
  const j = janelas.get(ip);
  if (!j || agora > j.ate) {
    janelas.set(ip, { ate: agora + 60_000, qtd: 1 });
    return false;
  }
  j.qtd++;
  return j.qtd > 20;
}

export const GET: APIRoute = async ({ url }) => {
  const slug = url.searchParams.get('slug');
  if (!slugValido(slug)) return json({ ok: false, erro: 'slug inválido' }, 400);
  try {
    const contagens = await lerReacoes(slug);
    // cache curto na borda: os números podem atrasar 1 min, ninguém se machuca
    return json({ ok: true, contagens }, 200, {
      'Cache-Control': 'public, max-age=0, s-maxage=60, stale-while-revalidate=300',
    });
  } catch (err) {
    console.error('[reacoes] falha ao ler:', err);
    return json({ ok: false, erro: 'indisponível' }, 503);
  }
};

export const POST: APIRoute = async ({ request, clientAddress }) => {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, erro: 'pedido inválido' }, 400);
  }

  const { slug, reacao } = body;
  const delta = body.delta === -1 ? -1 : 1;
  if (!slugValido(slug) || !REACOES.includes(reacao as Reacao)) {
    return json({ ok: false, erro: 'pedido inválido' }, 400);
  }

  let ip = 'desconhecido';
  try {
    ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || clientAddress;
  } catch {}
  if (estourou(ip)) return json({ ok: false, erro: 'calma aí :)' }, 429);

  try {
    const contagens = await registrarReacao(slug, reacao as Reacao, delta);
    return json({ ok: true, contagens }, 200);
  } catch (err) {
    console.error('[reacoes] falha ao gravar:', err);
    return json({ ok: false, erro: 'não consegui salvar agora' }, 500);
  }
};
