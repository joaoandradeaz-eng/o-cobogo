// O Cobogó · helpers compartilhados pelos mockups
// 1. Carrega os <symbol> defs do arquivo symbols.html
// 2. Randomiza peças e cores em containers com data-cobogo-wall

const PIECES = ['grade', 'circulos', 'labirinto', 'flor', 'octogonos', 'estrelas', 'barroca'];

const PALETTE = {
  concreto: '#A8A8A8',
  catedral: '#C73838',
  planalto: '#3A6B47',
  brasilia: '#2B3F6E',
  chumbo:   '#5C5A56',
  niemeyer: '#1A1A1A',
  lucio:    '#E8A945',
};

async function loadSymbols() {
  const res = await fetch('_assets/symbols.html');
  const html = await res.text();
  document.body.insertAdjacentHTML('afterbegin', html);
}

function pieceSvg(name, color, size = 48) {
  return `<svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet" style="color:${color};width:${size}px;height:${size}px;display:block">
    <use href="#cobogo-${name}" width="100" height="100"/>
  </svg>`;
}

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function randFrom(arr) { return arr[randInt(0, arr.length - 1)]; }

// Constrói uma parede (modo "concreto + 1 colorida + olho")
function buildWallConcreto(container, count = 14) {
  const colorPick = ['catedral', 'planalto', 'brasilia', 'lucio'];
  const coloredIdx = randInt(0, count - 1);
  const eyeIdx = (coloredIdx + randInt(2, count - 2)) % count; // não bate com a colorida
  const coloredColor = PALETTE[randFrom(colorPick)];

  let html = '';
  for (let i = 0; i < count; i++) {
    let color = PALETTE.concreto;
    if (i === coloredIdx) color = coloredColor;
    const piece = randFrom(PIECES);
    html += `<div class="cobogo-cell" style="position:relative">${pieceSvg(piece, color, '100%')}`;
    if (i === eyeIdx) {
      // pequeno "olho" — círculo niemeyer no centro
      html += `<span style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:18%;height:18%;background:${PALETTE.niemeyer};border-radius:50%"></span>`;
    }
    html += `</div>`;
  }
  container.innerHTML = html;
}

// Constrói uma parede modernista (todas com cor da paleta, mais concreto/chumbo, menos saturadas)
function buildWallModernista(container, count = 16) {
  // pesos: concreto e chumbo aparecem mais; catedral/planalto/brasilia/lucio são acentos
  const weighted = [
    'concreto','concreto','concreto','concreto','concreto',
    'chumbo','chumbo','chumbo',
    'niemeyer','niemeyer',
    'catedral','planalto','brasilia','lucio',
  ];
  const eyeIdx = randInt(2, count - 3);

  let html = '';
  for (let i = 0; i < count; i++) {
    const colorName = randFrom(weighted);
    const color = PALETTE[colorName];
    const piece = randFrom(PIECES);
    html += `<div class="cobogo-cell" style="position:relative">${pieceSvg(piece, color, '100%')}`;
    if (i === eyeIdx) {
      html += `<span style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:14%;height:14%;background:${PALETTE.niemeyer};border-radius:50%;box-shadow:0 0 0 2px ${PALETTE.lucio}"></span>`;
    }
    html += `</div>`;
  }
  container.innerHTML = html;
}

// Constrói uma série de peças isoladas (pontuação rítmica)
function buildPunctuation(targets) {
  // targets: array de { selector, piece, color, size }
  targets.forEach(t => {
    const el = document.querySelector(t.selector);
    if (!el) return;
    const piece = t.piece ?? randFrom(PIECES);
    const color = t.color ?? PALETTE.concreto;
    el.innerHTML = pieceSvg(piece, color, t.size ?? 48);
  });
}

// Constrói uma "fita pendurada" — linha horizontal com peças penduradas em
// ângulos variados, cordões de comprimentos diferentes, tamanhos diferentes.
// Uma das peças recebe o olho.
function buildBunting(container, count = 8) {
  // pesos: concreto/chumbo/niemeyer dominam, paleta colorida só como acento
  const weighted = [
    'concreto','concreto','concreto','concreto','concreto',
    'chumbo','chumbo','chumbo',
    'niemeyer','niemeyer',
    'catedral','planalto','brasilia','lucio',
  ];
  const eyeIdx = randInt(1, count - 2);

  let html = '<div class="bunting-line"></div><div class="bunting-pieces">';

  for (let i = 0; i < count; i++) {
    const tilt = (Math.random() - 0.5) * 16; // -8 a +8 graus
    const size = randInt(28, 44);
    const stringHeight = randInt(14, 28);
    const colorName = randFrom(weighted);
    const color = PALETTE[colorName];
    const piece = randFrom(PIECES);

    html += `<span class="bunting-piece" style="transform:rotate(${tilt.toFixed(2)}deg)">`;
    html += `<span class="bunting-string" style="height:${stringHeight}px"></span>`;
    html += `<span class="bunting-tile" style="position:relative;display:block">`;
    html += pieceSvg(piece, color, size);
    if (i === eyeIdx) {
      html += `<span style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:22%;height:22%;background:${PALETTE.niemeyer};border-radius:50%"></span>`;
    }
    html += `</span></span>`;
  }

  html += '</div>';
  container.innerHTML = html;
}

// Paleta de cores possíveis pro header colorido + texto em alto contraste +
// pupila do olho (clara qdo letra é escura, escura qdo letra é clara)
const HEADER_PALETTE = {
  catedral: { bg: '#C73838', text: '#fff',     dim: 'rgba(255,255,255,.65)', pupil: '#1E3A8A' },
  planalto: { bg: '#3A6B47', text: '#fff',     dim: 'rgba(255,255,255,.65)', pupil: '#1E3A8A' },
  brasilia: { bg: '#2B3F6E', text: '#fff',     dim: 'rgba(255,255,255,.65)', pupil: '#1E3A8A' },
  chumbo:   { bg: '#5C5A56', text: '#fff',     dim: 'rgba(255,255,255,.65)', pupil: '#1E3A8A' },
  niemeyer: { bg: '#1A1A1A', text: '#f9f9f6',  dim: 'rgba(249,249,246,.6)',  pupil: '#1E3A8A' },
  lucio:    { bg: '#E8A945', text: '#1A1A1A',  dim: 'rgba(26,26,26,.55)',    pupil: '#A8C5E8' },
  concreto: { bg: '#A8A8A8', text: '#1A1A1A',  dim: 'rgba(26,26,26,.55)',    pupil: '#A8C5E8' },
};

function pickHeaderColor() {
  const keys = Object.keys(HEADER_PALETTE);
  return keys[randInt(0, keys.length - 1)];
}

function applyHeaderColor(colorName) {
  const c = HEADER_PALETTE[colorName];
  if (!c) return;
  document.documentElement.style.setProperty('--head-bg', c.bg);
  document.documentElement.style.setProperty('--head-text', c.text);
  document.documentElement.style.setProperty('--head-dim', c.dim);
  document.documentElement.style.setProperty('--head-pupil', c.pupil);
}

// Constrói "fita na linha" — linha passa pelo centro das peças (miçangas no fio).
// Sem cordão pendurado. Mais cor (paleta cheia, peso equilibrado).
// Se matchColorHex é passado, garante que `matchCount` peças usem essa cor.
function buildBuntingOnLine(container, count = 8, matchColorHex = null, matchCount = 2) {
  // paleta cheia, com peso pra dar vida (cores quentes/saturadas mais comuns)
  const lifePool = [
    'concreto','concreto',
    'chumbo','chumbo',
    'niemeyer',
    'catedral','catedral','catedral',
    'planalto','planalto','planalto',
    'brasilia','brasilia','brasilia',
    'lucio','lucio','lucio',
  ];

  // índices pra peças que combinam com o header
  const matchIndices = new Set();
  while (matchColorHex && matchIndices.size < matchCount && matchIndices.size < count) {
    matchIndices.add(randInt(0, count - 1));
  }

  // olho: índice diferente dos matching (pra não sumir nenhum sinal)
  let eyeIdx = randInt(0, count - 1);
  let attempts = 0;
  while (matchIndices.has(eyeIdx) && attempts < 10) {
    eyeIdx = randInt(0, count - 1);
    attempts++;
  }

  let html = '<div class="bunting-line"></div><div class="bunting-pieces">';

  for (let i = 0; i < count; i++) {
    const tilt = (Math.random() - 0.5) * 16; // -8 a +8 graus
    const size = randInt(30, 46);

    let color;
    if (matchIndices.has(i)) {
      color = matchColorHex;
    } else {
      color = PALETTE[randFrom(lifePool)];
    }
    const piece = randFrom(PIECES);

    html += `<span class="bunting-piece" style="transform:rotate(${tilt.toFixed(2)}deg)">`;
    html += `<span class="bunting-tile" style="position:relative;display:block">`;
    html += pieceSvg(piece, color, size);
    if (i === eyeIdx) {
      html += `<span style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:22%;height:22%;background:${PALETTE.niemeyer};border-radius:50%;box-shadow:0 0 0 2px ${PALETTE.lucio}"></span>`;
    }
    html += `</span></span>`;
  }

  html += '</div>';
  container.innerHTML = html;
}

// Pares header×fileira que combinam visualmente (regras do João):
// - cinza (concreto/chumbo/niemeyer) ↔ vermelho (catedral)
// - azul (brasília) ↔ amarelo (lúcio)
// - verde (planalto) ↔ cinza
// - amarelo ↔ cinza
// - azul ↔ cinza
const COLOR_PAIRS = [
  // cinza ↔ vermelho
  ['concreto','catedral'], ['chumbo','catedral'], ['niemeyer','catedral'],
  ['catedral','concreto'], ['catedral','chumbo'], ['catedral','niemeyer'],
  // azul ↔ amarelo
  ['brasilia','lucio'], ['lucio','brasilia'],
  // verde ↔ cinza
  ['concreto','planalto'], ['chumbo','planalto'], ['niemeyer','planalto'],
  ['planalto','concreto'], ['planalto','chumbo'], ['planalto','niemeyer'],
  // amarelo ↔ cinza
  ['concreto','lucio'], ['chumbo','lucio'], ['niemeyer','lucio'],
  ['lucio','concreto'], ['lucio','chumbo'], ['lucio','niemeyer'],
  // azul ↔ cinza
  ['concreto','brasilia'], ['chumbo','brasilia'], ['niemeyer','brasilia'],
  ['brasilia','concreto'], ['brasilia','chumbo'], ['brasilia','niemeyer'],
];

function pickColorPair() {
  return randFrom(COLOR_PAIRS);
}

// Constrói uma fileira edge-to-edge de cobogós idênticos em cor única.
// Renderiza como background-image SVG tileado (1 elemento DOM, performance ok).
function buildStripe(container, pieceName, colorHex, tileSize = 14) {
  const symbol = document.getElementById(`cobogo-${pieceName}`);
  if (!symbol) return;
  const viewBox = symbol.getAttribute('viewBox') || '0 0 100 100';
  // Pega o conteúdo do symbol e troca currentColor pela cor real
  const inner = symbol.innerHTML.replace(/currentColor/g, colorHex);
  // Constrói SVG standalone
  const svgTile = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='${viewBox}'>${inner}</svg>`;
  const encoded = encodeURIComponent(svgTile)
    .replace(/'/g, '%27').replace(/"/g, '%22');
  const dataUri = `data:image/svg+xml;utf8,${encoded}`;
  container.style.backgroundImage = `url("${dataUri}")`;
  container.style.backgroundSize = `${tileSize}px ${tileSize}px`;
  container.style.backgroundRepeat = 'repeat-x';
  container.style.backgroundPosition = '0 center';
  container.style.height = `${tileSize}px`;
}

// === Variações de paredão (Teste 1) ===

// 1a — Mono: M4d empilhado, mesma peça e cor em N linhas
function buildWallMono(container, pieceName, colorHex, rows = 7, tileSize = 14) {
  buildStripe(container, pieceName, colorHex, tileSize);
  container.style.height = `${rows * tileSize}px`;
  container.style.backgroundRepeat = 'repeat';
}

// 1b — Listras: N linhas, cada uma com peça e cor próprias (uniforme dentro)
function buildWallRows(container, rows = 7, tileSize = 14, excludeColorHex = null) {
  const colorKeys = Object.keys(PALETTE).filter(k => PALETTE[k] !== excludeColorHex);
  let html = '';
  const choices = [];
  for (let r = 0; r < rows; r++) {
    const piece = randFrom(PIECES);
    const colorKey = randFrom(colorKeys);
    choices.push({ piece, colorKey });
    html += `<div class="wall-row" style="height:${tileSize}px"></div>`;
  }
  container.innerHTML = html;
  container.style.fontSize = '0';
  Array.from(container.children).forEach((rowEl, i) => {
    const c = choices[i];
    buildStripe(rowEl, c.piece, PALETTE[c.colorKey], tileSize);
  });
}

// 1c — Caótico: cada célula com peça e cor independentes.
// Cada linha é seu próprio div com white-space:nowrap → o último tile
// que não cabe inteiro fica VISÍVEL e cortado pela direita (em vez de
// wrappar pra linha de baixo escondida e deixar gap branco no final).
function buildWallChaos(container, rows = 7, tileSize = 14) {
  const colors = Object.values(PALETTE);
  const cols = Math.ceil((window.innerWidth + tileSize * 4) / tileSize);
  let html = '';
  for (let r = 0; r < rows; r++) {
    html += `<div style="height:${tileSize}px;white-space:nowrap;overflow:hidden;font-size:0;line-height:0">`;
    for (let c = 0; c < cols; c++) {
      const piece = randFrom(PIECES);
      const color = randFrom(colors);
      html += `<svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet" style="color:${color};width:${tileSize}px;height:${tileSize}px;display:inline-block;vertical-align:top"><use href="#cobogo-${piece}" width="100" height="100"/></svg>`;
    }
    html += `</div>`;
  }
  container.innerHTML = html;
  container.style.fontSize = '0';
  container.style.lineHeight = '0';
  container.style.height = `${rows * tileSize}px`;
  container.style.overflow = 'hidden';
  container.style.width = '100%';
}

// === Teste 2: fileira caótica (1 linha, peça e cor por célula) ===
function buildStripeChaos(container, tileSize = 14) {
  buildWallChaos(container, 1, tileSize);
}

// Constrói coluna lateral (margem)
function buildSidebar(container, count = 6) {
  const colorPick = ['catedral', 'planalto', 'brasilia', 'lucio'];
  const coloredIdx = randInt(1, count - 2);
  const eyeIdx = randInt(0, count - 1);
  const coloredColor = PALETTE[randFrom(colorPick)];

  let html = '';
  for (let i = 0; i < count; i++) {
    let color = PALETTE.concreto;
    if (i === coloredIdx) color = coloredColor;
    const piece = randFrom(PIECES);
    html += `<div class="cobogo-cell" style="position:relative">${pieceSvg(piece, color, '100%')}`;
    if (i === eyeIdx && i !== coloredIdx) {
      html += `<span style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:18%;height:18%;background:${PALETTE.niemeyer};border-radius:50%"></span>`;
    }
    html += `</div>`;
  }
  container.innerHTML = html;
}

// Init
window.addEventListener('DOMContentLoaded', async () => {
  await loadSymbols();
  document.dispatchEvent(new Event('cobogo:ready'));
});
