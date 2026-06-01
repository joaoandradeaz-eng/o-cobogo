import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';

export const prerender = true;

export async function GET(context) {
  const articles = await getCollection('articles', ({ data }) => !data.draft);
  articles.sort((a, b) => b.data.date.getTime() - a.data.date.getTime());

  return rss({
    title: 'O Cobogó',
    description: 'Revista editorial sobre cidade, cultura e arquitetura — por João Andrade.',
    site: context.site,
    items: articles.map((a) => ({
      title: a.data.title.replace(/\*/g, ''),
      description: a.data.dek.replace(/\*/g, ''),
      pubDate: a.data.date,
      link: `/${a.id}/`,
      categories: a.data.categories,
    })),
    customData: '<language>pt-BR</language>',
  });
}
