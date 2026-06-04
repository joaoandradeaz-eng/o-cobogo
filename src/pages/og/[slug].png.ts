import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { renderArticleCard } from '../../lib/og/card';

// Um cartão de social por artigo publicado, gerado no build -> /og/<slug>.png.
export const prerender = true;

export async function getStaticPaths() {
  const [articles, tags] = await Promise.all([getCollection('articles'), getCollection('tags')]);
  const tagById = new Map(tags.map((t) => [t.id, t.data]));

  return articles
    .filter((a) => !a.data.draft)
    .map((a) => {
      const editoriaId = a.data.categories?.[0];
      const tag = editoriaId ? tagById.get(editoriaId) : undefined;
      return {
        params: { slug: a.id },
        props: {
          title: a.data.title.replace(/\*/g, ''), // tira o markdown de ênfase (*texto*)
          readTime: a.data.readTime ?? '',
          editoriaName: tag?.name ?? 'O Cobogó',
          editoriaColor: tag?.color ?? '#1B1612',
          editoriaText: tag?.textColor ?? '#f9f9f6',
        },
      };
    });
}

export const GET: APIRoute = async ({ props }) => {
  const png = await renderArticleCard(props as any);
  return new Response(new Uint8Array(png), {
    headers: {
      'content-type': 'image/png',
      'cache-control': 'public, max-age=31536000, immutable',
    },
  });
};
