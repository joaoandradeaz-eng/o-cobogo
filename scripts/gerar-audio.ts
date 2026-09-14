/**
 * Gera a versão narrada (MP3) de um artigo do Cobogó e grava o caminho no
 * frontmatter. Roda no Mac, uma vez por texto (não roda no site).
 *
 *   npm run audio -- <slug>                 gera com o provedor padrão
 *   npm run audio -- <slug> --texto         só imprime o texto que seria narrado
 *   npm run audio -- <slug> --provedor openai --voz onyx
 *   npm run audio -- <slug> --forcar        regenera mesmo se já existe
 *
 * Provedores (chave lida do .env ou do ambiente):
 *   elevenlabs  ELEVENLABS_API_KEY  (+ ELEVENLABS_VOICE_ID, ELEVENLABS_MODEL_ID)
 *   openai      OPENAI_API_KEY      (+ OPENAI_TTS_VOICE, OPENAI_TTS_MODEL)
 *
 * Precisa de ffmpeg/ffprobe no PATH (brew install ffmpeg) pra juntar os blocos
 * e medir a duração. Saída: public/audio/<slug>.mp3 (mono, 80 kbps: ~4 MB por
 * 7 minutos — leve pro celular e sem perda audível em voz).
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import matter from 'gray-matter';
import { montarNarracao, agruparBlocos } from '../src/lib/narracao.ts';

// ---------- argumentos ----------
const args = process.argv.slice(2);
const slug = args.find((a) => !a.startsWith('--'));
const flag = (n: string) => args.includes(`--${n}`);
const opt = (n: string) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : undefined; };
if (!slug) { console.error('uso: npm run audio -- <slug> [--texto] [--forcar] [--provedor elevenlabs|openai] [--voz id]'); process.exit(1); }

// ---------- .env (sem dependência: lê só KEY=valor) ----------
if (existsSync('.env')) {
  for (const linha of readFileSync('.env', 'utf8').split('\n')) {
    const m = linha.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

const provedor = opt('provedor') ?? process.env.TTS_PROVEDOR ?? 'elevenlabs';
const arquivo = join('src/content/articles', `${slug}.md`);
if (!existsSync(arquivo)) { console.error(`artigo não encontrado: ${arquivo}`); process.exit(1); }

const raw = readFileSync(arquivo, 'utf8');
const { data: fm, content: corpo } = matter(raw);
const paragrafos = montarNarracao({ title: fm.title, linhaFina: fm.linhaFina, notas: fm.notas }, corpo);
const texto = paragrafos.join('\n\n');

if (flag('texto')) {
  console.log(texto);
  console.log(`\n--- ${texto.length} caracteres, ${paragrafos.length} parágrafos ---`);
  process.exit(0);
}

const saida = join('public/audio', `${slug}.mp3`);
if (existsSync(saida) && !flag('forcar')) {
  console.error(`já existe ${saida} — use --forcar pra regenerar`);
  process.exit(1);
}

// ---------- provedores ----------
type Gerador = (bloco: string, ctx: { anterior: string; proximo: string }) => Promise<Buffer>;

function elevenlabs(): { gerar: Gerador; rotulo: string; max: number } {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) throw new Error('falta ELEVENLABS_API_KEY no .env');
  const voice = opt('voz') ?? process.env.ELEVENLABS_VOICE_ID;
  if (!voice) throw new Error('falta ELEVENLABS_VOICE_ID no .env (ou --voz)');
  const model = process.env.ELEVENLABS_MODEL_ID ?? 'eleven_v3';
  return {
    rotulo: `elevenlabs:${model}:${voice}`,
    max: 4500,
    gerar: async (bloco, ctx) => {
      const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}?output_format=mp3_44100_128`, {
        method: 'POST',
        headers: { 'xi-api-key': key, 'content-type': 'application/json' },
        body: JSON.stringify({
          text: bloco,
          model_id: model,
          // language_code só existe nos modelos Turbo/Flash v2.5; no Multilingual v2
          // e no v3 o idioma é detectado do texto (e a voz é brasileira nativa).
          ...(model.includes('v2_5') ? { language_code: 'pt' } : {}),
          // contexto dos blocos vizinhos mantém a entonação contínua entre requisições
          // (o v3 ainda não aceita; os blocos já quebram só em fim de parágrafo)
          ...(model.includes('v3') ? {} : { previous_text: ctx.anterior.slice(-600) || undefined, next_text: ctx.proximo.slice(0, 600) || undefined }),
          // Regulagem aprovada pelo João (14/09/2026): v3 "natural" = stability 0.5.
          // (No v3 a estabilidade só aceita 0.0 criativo / 0.5 natural / 1.0 robusto.)
          voice_settings: model.includes('v3')
            ? { stability: 0.5, similarity_boost: 0.8, use_speaker_boost: true }
            : { stability: 0.45, similarity_boost: 0.8, style: 0.25, use_speaker_boost: true },
        }),
      });
      if (!r.ok) throw new Error(`ElevenLabs ${r.status}: ${await r.text()}`);
      return Buffer.from(await r.arrayBuffer());
    },
  };
}

function openai(): { gerar: Gerador; rotulo: string; max: number } {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error('falta OPENAI_API_KEY no .env');
  const voice = opt('voz') ?? process.env.OPENAI_TTS_VOICE ?? 'onyx';
  const model = process.env.OPENAI_TTS_MODEL ?? 'gpt-4o-mini-tts';
  return {
    rotulo: `openai:${model}:${voice}`,
    max: 3800, // limite da API: 4096 caracteres por requisição
    gerar: async (bloco) => {
      const r = await fetch('https://api.openai.com/v1/audio/speech', {
        method: 'POST',
        headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
        body: JSON.stringify({
          model, voice, input: bloco, response_format: 'mp3',
          instructions: 'Narre em português do Brasil, como um ensaio lido em voz alta: ritmo calmo, tom de conversa culta, pausas naturais nas vírgulas e nos pontos, sem exagero dramático.',
        }),
      });
      if (!r.ok) throw new Error(`OpenAI ${r.status}: ${await r.text()}`);
      return Buffer.from(await r.arrayBuffer());
    },
  };
}

const P = provedor === 'openai' ? openai() : provedor === 'elevenlabs' ? elevenlabs() : (() => { throw new Error(`provedor desconhecido: ${provedor}`); })();

// ---------- geração ----------
const blocos = agruparBlocos(paragrafos, P.max);
console.log(`${slug}: ${texto.length} caracteres em ${blocos.length} bloco(s) → ${P.rotulo}`);
const tmp = join('.data', 'audio-tmp', slug);
rmSync(tmp, { recursive: true, force: true });
mkdirSync(tmp, { recursive: true });
const partes: string[] = [];
for (let i = 0; i < blocos.length; i++) {
  process.stdout.write(`  bloco ${i + 1}/${blocos.length} (${blocos[i].length} chars)… `);
  const mp3 = await P.gerar(blocos[i], { anterior: blocos[i - 1] ?? '', proximo: blocos[i + 1] ?? '' });
  const f = join(tmp, `${String(i).padStart(3, '0')}.mp3`);
  writeFileSync(f, mp3);
  partes.push(f);
  console.log('ok');
}

// junta os blocos com um respiro de 0,6 s entre eles e reencoda leve (mono, 80 kbps)
mkdirSync('public/audio', { recursive: true });
const lista = join(tmp, 'lista.txt');
writeFileSync(lista, partes.map((f) => `file '${f.split('/').pop()}'`).join('\n'));
const filtro = partes.length > 1 ? ['-af', 'apad=pad_dur=0'] : [];
execFileSync('ffmpeg', ['-y', '-v', 'error', '-f', 'concat', '-safe', '0', '-i', lista, ...filtro, '-ac', '1', '-ar', '44100', '-b:a', '80k', saida], { stdio: 'inherit' });
const segundos = parseFloat(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', saida]).toString());
const minutos = Math.max(1, Math.round(segundos / 60));
rmSync(tmp, { recursive: true, force: true });

// ---------- frontmatter ----------
fm.audio = `/audio/${slug}.mp3`;
fm.audioDuracao = `${minutos} min`;
fm.audioVoz = P.rotulo;
writeFileSync(arquivo, matter.stringify(corpo.replace(/\s+$/, '') + '\n', fm));
console.log(`pronto: ${saida} (${Math.round(segundos)} s ≈ ${minutos} min) — frontmatter atualizado`);
