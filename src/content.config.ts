import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

/**
 * Categorias editoriais — espelha as 6 cores de tag definidas em global.css
 * (data-cat="ensaio" etc).
 */
const categoryEnum = z.enum([
  'ensaio',
  'reportagem',
  'critica',
  'entrevista',
  'memoria',
  'cidade-casa',
]);

const articles = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/articles' }),
  schema: z.object({
    /** Título do artigo. Use *asterisco* pra marcar palavra(s) em itálico. */
    title: z.string(),
    /** Subtítulo / dek mostrado abaixo do título. */
    dek: z.string(),
    /** 1+ categorias. A primeira é a principal (cor dominante). */
    categories: z.array(categoryEnum).min(1),
    /** Autor — por enquanto string livre, vira referência quando criarmos coleção de autores. */
    author: z.string().default('João Andrade'),
    /** Data de publicação (formato: YYYY-MM-DD). */
    date: z.date(),
    /** Tempo estimado de leitura, ex: "14 min". */
    readTime: z.string(),
    /** Caminho da foto de capa (em /public/assets/...) — opcional enquanto usamos placeholder. */
    heroImage: z.string().optional(),
    /** Legenda da foto de capa. */
    heroCaption: z.string().optional(),
    /** Linha-fina: kicker em destaque acima do corpo do texto. Use *itálico* livremente. */
    linhaFina: z.string().optional(),
    /** Rótulo da linha-fina. Padrão: "Linha-fina". String vazia ou undefined → não renderiza rótulo. */
    linhaFinaLabel: z.string().optional(),
    /** Notas de rodapé / referências. Cada string é uma nota. Use *itálico* livremente. */
    notas: z.array(z.string()).optional(),
    /** Se true, não publica o artigo (não aparece em listagens nem é renderizado). */
    draft: z.boolean().default(false),
  }),
});

export const collections = { articles };
