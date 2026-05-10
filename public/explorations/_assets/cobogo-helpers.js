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

// Paleta de cores possíveis pro header colorido + texto em alto contraste
const HEADER_PALETTE = {
  catedral: { bg: '#C73838', text: '#fff', dim: 'rgba(255,255,255,.65)' },
  planalto: { bg: '#3A6B47', text: '#fff', dim: 'rgba(255,255,255,.65)' },
  brasilia: { bg: '#2B3F6E', text: '#fff', dim: 'rgba(255,255,255,.65)' },
  chumbo:   { bg: '#5C5A56', text: '#fff', dim: 'rgba(255,255,255,.65)' },
  niemeyer: { bg: '#1A1A1A', text: '#f9f9f6', dim: 'rgba(249,249,246,.6)' },
  lucio:    { bg: '#E8A945', text: '#1A1A1A', dim: 'rgba(26,26,26,.55)' },
  concreto: { bg: '#A8A8A8', text: '#1A1A1A', dim: 'rgba(26,26,26,.55)' },
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
