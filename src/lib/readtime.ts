// Cálculo de tempo de leitura, compartilhado pelo editor (ao vivo) e pela API
// (na hora de publicar). Mantê-lo num só lugar garante que os dois nunca divirjam.
// Função pura, sem dependências — pode rodar no cliente e no servidor.

const WORDS_PER_MINUTE = 200; // ritmo médio de leitura de texto corrido em pt-BR

// Conta palavras de um texto que pode vir como HTML (do editor) ou markdown (da API).
export function countWords(raw: string): number {
  if (!raw) return 0;
  const text = raw
    .replace(/<[^>]+>/g, ' ') // tags HTML
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ') // imagens markdown ![alt](url)
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1') // links markdown [texto](url) -> texto
    .replace(/&[a-z]+;/gi, ' ') // entidades HTML (&nbsp; etc.)
    .replace(/[#>*_`~|=+-]+/g, ' ') // pontuação estrutural de markdown
    .replace(/\s+/g, ' ')
    .trim();
  if (!text) return 0;
  return text.split(' ').filter(Boolean).length;
}

// Devolve o tempo de leitura já formatado, ex.: "8 min". Mínimo de 1 min.
export function estimateReadTime(raw: string): string {
  const words = countWords(raw);
  const minutes = Math.max(1, Math.round(words / WORDS_PER_MINUTE));
  return `${minutes} min`;
}
