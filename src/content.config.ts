import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

/** As 7 peças cobogó do sistema modernista. Cada tag pode ter uma associada como ícone. */
const cobogoPieces = z.enum([
  'grade',
  'circulos',
  'labirinto',
  'flor',
  'octogonos',
  'estrelas',
  'barroca',
]);

const articles = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/articles' }),
  schema: z.object({
    /** Título do artigo. Use *asterisco* pra marcar palavra(s) em itálico. */
    title: z.string(),
    /** Subtítulo / dek mostrado abaixo do título. Opcional — vazio não renderiza. */
    dek: z.string().default(''),
    /** 1+ tags (slugs validados dinamicamente pela coleção `tags`). A primeira é a principal. */
    categories: z.array(z.string()).min(1),
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
    /** Enquadramento da capa dentro da moldura fixa: ponto de foco (object-position), ex "50% 30%". */
    heroPosition: z.string().optional(),
    /** Zoom da capa dentro da moldura (1 = preenche; >1 aproxima). Padrão 1. */
    heroZoom: z.number().optional(),
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

/** Tags / categorias editoriais. JSON files em src/content/tags/, gerenciados via /admin/tags. */
const tags = defineCollection({
  loader: glob({ pattern: '**/*.json', base: './src/content/tags' }),
  schema: z.object({
    /** Nome de exibição da tag (qualquer string, com acentos). */
    name: z.string(),
    /** Cor de fundo da chip (hex). */
    color: z.string(),
    /** Cor do texto da chip (hex). */
    textColor: z.string(),
    /** Slug da tag-pai (hierarquia de 1 nível). null = tag de topo. */
    parent: z.string().nullable().optional().default(null),
    /** Descrição breve da tag — não exibida ainda, mas guardada pra futuro. */
    description: z.string().optional().default(''),
    /** Peça cobogó associada como ícone visual da tag (1 das 7 do sistema). */
    piece: cobogoPieces.optional().default('grade'),
    /** Ordem de exibição (menor = primeiro). Default 100. */
    order: z.number().optional().default(100),
  }),
});

export const collections = { articles, tags };
