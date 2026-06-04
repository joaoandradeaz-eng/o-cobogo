// Geração dos cartões de social (Open Graph) — roda só no BUILD (rotas
// prerenderizadas em src/pages/og/*). Usa satori (HTML/CSS -> SVG, com a fonte
// Bitter embutida, sem depender de fonte instalada no servidor) + sharp (SVG ->
// PNG). O resultado vira arquivo estático em /og/<slug>.png.
import satori from 'satori';
import sharp from 'sharp';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// cores da marca (espelham os tokens de src/styles/global.css)
const PAPER = '#f9f9f6';
const INK = '#1B1612';
const INK3 = '#6B6055';
const TERRA = '#B85A1F';

// Lê as fontes a partir da raiz do projeto (cwd no build = raiz do repo).
const fontsDir = join(process.cwd(), 'src/lib/og/fonts');
const fonts = [
  { name: 'Bitter', data: readFileSync(join(fontsDir, 'Bitter-400.woff')), weight: 400 as const, style: 'normal' as const },
  { name: 'Bitter', data: readFileSync(join(fontsDir, 'Bitter-600.woff')), weight: 600 as const, style: 'normal' as const },
  { name: 'Bitter', data: readFileSync(join(fontsDir, 'Bitter-700.woff')), weight: 700 as const, style: 'normal' as const },
];

// helper p/ montar nós no formato que o satori entende, sem precisar de JSX
const h = (type: string, props: Record<string, any>, ...children: any[]): any => ({
  type,
  props: { ...props, children: children.flat() },
});

// Título grande encolhe um pouco em textos longos pra caber no quadro.
function titleSize(title: string): number {
  const n = title.length;
  if (n > 78) return 50;
  if (n > 52) return 58;
  return 66;
}

const wordmark = () =>
  h('div', { style: { display: 'flex', fontSize: '30px', fontWeight: 700, letterSpacing: '4px', color: INK } }, 'O COBOGÓ');

async function toPng(node: any): Promise<Buffer> {
  const svg = await satori(node, { width: 1200, height: 630, fonts });
  return sharp(Buffer.from(svg)).png().toBuffer();
}

export type ArticleCardInput = {
  title: string;
  editoriaName: string;
  editoriaColor: string;
  editoriaText: string;
  readTime: string;
};

// Cartão por artigo: wordmark + pílula da editoria + título + assinatura/domínio.
export function renderArticleCard(input: ArticleCardInput): Promise<Buffer> {
  const node = h(
    'div',
    {
      style: {
        width: '1200px',
        height: '630px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        background: PAPER,
        padding: '72px',
        fontFamily: 'Bitter',
      },
    },
    h(
      'div',
      { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' } },
      wordmark(),
      h(
        'div',
        {
          style: {
            display: 'flex',
            fontSize: '24px',
            fontWeight: 600,
            letterSpacing: '2px',
            textTransform: 'uppercase',
            color: input.editoriaText,
            background: input.editoriaColor,
            padding: '10px 22px',
            borderRadius: '4px',
          },
        },
        input.editoriaName
      )
    ),
    h(
      'div',
      {
        style: {
          display: 'flex',
          fontSize: `${titleSize(input.title)}px`,
          fontWeight: 700,
          lineHeight: 1.12,
          color: INK,
          maxWidth: '1010px',
        },
      },
      input.title
    ),
    h(
      'div',
      { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '26px' } },
      h('div', { style: { display: 'flex', color: INK3 } }, `por João Andrade · ${input.readTime}`),
      h('div', { style: { display: 'flex', fontWeight: 600, color: TERRA } }, 'ocobogo.com.br')
    )
  );
  return toPng(node);
}

// Cartão padrão (home, sobre e qualquer página sem capa própria).
export function renderDefaultCard(): Promise<Buffer> {
  const node = h(
    'div',
    {
      style: {
        width: '1200px',
        height: '630px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        background: PAPER,
        padding: '72px',
        fontFamily: 'Bitter',
        textAlign: 'center',
      },
    },
    h('div', { style: { display: 'flex', fontSize: '88px', fontWeight: 700, letterSpacing: '2px', color: INK } }, 'O Cobogó'),
    h(
      'div',
      { style: { display: 'flex', marginTop: '24px', fontSize: '30px', fontWeight: 400, color: INK3 } },
      'Revista editorial sobre cidade, cultura e arquitetura'
    ),
    h('div', { style: { display: 'flex', marginTop: '40px', fontSize: '26px', fontWeight: 600, color: TERRA } }, 'ocobogo.com.br')
  );
  return toPng(node);
}
