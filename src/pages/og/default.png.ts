import type { APIRoute } from 'astro';
import { renderDefaultCard } from '../../lib/og/card';

// Cartão de social padrão (home, sobre e qualquer página sem capa).
// Gerado no build -> arquivo estático /og/default.png.
export const prerender = true;

export const GET: APIRoute = async () => {
  const png = await renderDefaultCard();
  return new Response(new Uint8Array(png), {
    headers: {
      'content-type': 'image/png',
      'cache-control': 'public, max-age=31536000, immutable',
    },
  });
};
