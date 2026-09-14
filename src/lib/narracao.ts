/**
 * Prepara o texto de um artigo pra ser narrado por voz sintética.
 *
 * Entrada: frontmatter + corpo em markdown (do arquivo em src/content/articles).
 * Saída: texto corrido, sem marcação, dividido em blocos que cabem numa
 * requisição de TTS. É função pura: roda no script de geração e pode rodar
 * em teste sem tocar rede.
 *
 * Regras editoriais da narração:
 *  - lê título, linha-fina e corpo; NÃO lê as notas de rodapé (viram um
 *    aviso curto no fim, "As notas estão no site").
 *  - negrito/itálico/marca-texto somem (são grifos visuais, não de leitura).
 *  - números de nota (<sup>) somem.
 *  - tabelas, gráficos e imagens são pulados.
 *  - abreviações que a voz lê errado são expandidas (ver EXPANSOES).
 */

export type Frontmatter = {
  title: string;
  linhaFina?: string;
  notas?: string[];
};

/** Trocas fixas de grafia → fala. Só o que a voz costuma errar em pt-BR. */
const EXPANSOES: Array<[RegExp, string]> = [
  [/\b6x1\b/g, 'seis por um'],
  [/\b(\d{1,2})x(\d{1,2})\b/g, '$1 por $2'],
  // horas "16h17" → "16 horas e 17"; "16h" → "16 horas"
  [/\b(\d{1,2})h(\d{2})\b/g, '$1 horas e $2'],
  [/\b(\d{1,2})h\b/g, '$1 horas'],
  // siglas do Congresso que a voz tende a soletrar errado
  [/\bPLP\b/g, 'P L P'],
  [/\bPEC\b/g, 'péc'],
  [/\bPL\b/g, 'P L'],
  [/\bMPE\b/g, 'M P E'],
  [/\bSTF\b/g, 'S T F'],
  [/\bTSE\b/g, 'T S E'],
  [/\bCCJ\b/g, 'C C J'],
  [/\bMEI\b/g, 'M E I'],
  [/\bCACB\b/g, 'C A C B'],
  [/\bIDP\b/g, 'I D P'],
  [/\bONU\b/g, 'ônu'],
  [/\bFGTS\b/g, 'F G T S'],
  // "R$ 1.434" → "1.434 reais" (a voz costuma ler "R cifrão")
  [/R\$\s?([\d.,]+)/g, '$1 reais'],
  // "nº" / "n.º" → "número"
  [/\bn\.?º\s?/g, 'número '],
  // "art." → "artigo"
  [/\bart\.\s?/gi, 'artigo '],
];

/** Tira toda a marcação (markdown + HTML embutido) de um trecho inline. */
export function limparInline(s: string): string {
  return s
    .replace(/<sup>[\s\S]*?<\/sup>/gi, '') // números de nota
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, '') // qualquer outra tag
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '') // imagens markdown
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1') // links → só o texto
    .replace(/(\*\*|__)(.*?)\1/g, '$2') // negrito
    .replace(/(\*|_)(.*?)\1/g, '$2') // itálico
    .replace(/==(.*?)==/g, '$1') // marca-texto
    .replace(/`([^`]*)`/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

function expandir(s: string): string {
  let out = s;
  for (const [re, sub] of EXPANSOES) out = out.replace(re, sub);
  return out;
}

/** Quebra o corpo markdown em parágrafos narráveis (já limpos). */
export function paragrafosDoCorpo(md: string): string[] {
  // 1) remove blocos que não se narram: tabelas, gráficos, figuras, imagens, código
  let corpo = md
    .replace(/<table[\s\S]*?<\/table>/gi, '\n\n')
    .replace(/<div[^>]*data-chart[\s\S]*?<\/div>\s*<\/div>/gi, '\n\n')
    .replace(/<figure[\s\S]*?<\/figure>/gi, '\n\n')
    .replace(/<img[^>]*>/gi, '\n\n')
    .replace(/```[\s\S]*?```/g, '\n\n')
    .replace(/^\s*<hr\s*\/?>\s*$/gim, '\n\n')
    .replace(/^\s*(-{3,}|\*{3,}|_{3,})\s*$/gm, '\n\n');

  const blocos = corpo.split(/\n\s*\n/);
  const out: string[] = [];
  for (const b of blocos) {
    let t = b.trim();
    if (!t) continue;
    // títulos de seção: viram frase com pausa
    t = t.replace(/^#{1,6}\s+/, '');
    // citações: tira o ">"
    t = t.replace(/^>\s?/gm, '');
    // listas: cada item vira frase
    t = t.replace(/^\s*[-*+]\s+/gm, '').replace(/^\s*\d+\.\s+/gm, '');
    // parágrafos alinhados vêm como <p style=...>…</p>
    t = t.replace(/<\/?p[^>]*>/gi, '');
    t = t.replace(/<\/?h[1-6][^>]*>/gi, '');
    const limpo = limparInline(t);
    if (limpo) out.push(expandir(limpo));
  }
  return out;
}

/**
 * Texto completo da narração, como lista de parágrafos.
 * Abertura: título + linha-fina. Fecho: aviso das notas, se houver.
 */
export function montarNarracao(fm: Frontmatter, md: string): string[] {
  const partes: string[] = [];
  partes.push(expandir(limparInline(fm.title)) + '.');
  if (fm.linhaFina && fm.linhaFina.trim()) {
    partes.push(expandir(limparInline(fm.linhaFina)));
  }
  partes.push(...paragrafosDoCorpo(md));
  if (fm.notas && fm.notas.length) {
    partes.push('As notas e referências deste texto estão na versão escrita, no site.');
  }
  return partes;
}

/**
 * Agrupa parágrafos em blocos de até `max` caracteres, sem cortar parágrafo
 * no meio. Um bloco = uma requisição ao provedor de voz. Blocos maiores dão
 * entonação mais contínua; o limite depende do provedor.
 */
export function agruparBlocos(paragrafos: string[], max = 4500): string[] {
  const blocos: string[] = [];
  let atual = '';
  for (const p of paragrafos) {
    if (p.length > max) {
      // parágrafo gigante: quebra por frase
      const frases = p.match(/[^.!?]+[.!?]+["”']?\s*/g) ?? [p];
      for (const f of frases) {
        if ((atual + f).length > max && atual) { blocos.push(atual.trim()); atual = ''; }
        atual += f;
      }
      continue;
    }
    if ((atual + '\n\n' + p).length > max && atual) { blocos.push(atual.trim()); atual = ''; }
    atual = atual ? atual + '\n\n' + p : p;
  }
  if (atual.trim()) blocos.push(atual.trim());
  return blocos;
}
