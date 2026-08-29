import type { APIRoute } from 'astro';
import { normalizarContato, salvarInscrito, type Canal } from '../../lib/inscritos';

export const prerender = false;

// Toda resposta sai com content-type JSON (mesmo racional do api/posts).
function json(payload: unknown, status: number): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

// Freio simples por IP (melhor esforço: o Map zera quando a função serverless
// recicla, o que é aceitável pra um blog — o alvo é script burro, não ataque).
const janelas = new Map<string, { ate: number; qtd: number }>();
function estourou(ip: string): boolean {
  const agora = Date.now();
  const j = janelas.get(ip);
  if (!j || agora > j.ate) {
    janelas.set(ip, { ate: agora + 60_000, qtd: 1 });
    return false;
  }
  j.qtd++;
  return j.qtd > 8;
}

export const POST: APIRoute = async ({ request, clientAddress }) => {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, erro: 'Pedido inválido.' }, 400);
  }

  // Honeypot: campo invisível pra humanos; bot que preencher recebe um
  // "sucesso" de fachada e nada é salvo.
  if (typeof body.site === 'string' && body.site.trim() !== '') {
    return json({ ok: true, jaExistia: false }, 200);
  }

  const canal = body.canal;
  if (canal !== 'email' && canal !== 'whatsapp') {
    return json({ ok: false, erro: 'Escolha e-mail ou WhatsApp.' }, 400);
  }

  const contato = normalizarContato(canal as Canal, String(body.contato ?? ''));
  if (!contato) {
    const erro =
      canal === 'email'
        ? 'Esse e-mail não parece válido. Confere pra mim?'
        : 'Esse número não parece válido. Use DDD + celular, tipo (61) 99999-9999.';
    return json({ ok: false, erro }, 400);
  }

  let ip = 'desconhecido';
  try {
    ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || clientAddress;
  } catch {}
  if (estourou(ip)) {
    return json({ ok: false, erro: 'Muitas tentativas seguidas. Espera um minuto.' }, 429);
  }

  // Origem: caminho da página onde a pessoa estava (pro João saber qual texto converteu)
  let origem = typeof body.origem === 'string' ? body.origem : '';
  if (!origem) {
    try {
      origem = new URL(request.headers.get('referer') ?? '').pathname;
    } catch {}
  }
  if (!/^\/[\w\-/]*$/.test(origem)) origem = '/';

  try {
    const resultado = await salvarInscrito({ canal: canal as Canal, contato, origem });
    return json(resultado, resultado.ok ? 200 : 503);
  } catch (err) {
    console.error('[inscrever] falha ao salvar:', err);
    return json({ ok: false, erro: 'Não consegui salvar agora. Tenta de novo em instantes?' }, 500);
  }
};
