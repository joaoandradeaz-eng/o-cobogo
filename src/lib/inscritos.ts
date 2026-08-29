import { Octokit } from '@octokit/rest';

/**
 * Base de inscritos da newsletter: um inscritos.csv num repositório PRIVADO
 * (joaoandradeaz-eng/o-cobogo-inscritos), escrito via token próprio
 * (INSCRITOS_GITHUB_TOKEN) — separado do GITHUB_TOKEN do blog, que só
 * alcança o repo público. Dados pessoais de leitores nunca podem parar
 * no repo público do site.
 *
 * Em dev sem token, cai num CSV local (.data/, fora do git) pra dar pra
 * testar o fluxo inteiro sem credencial.
 */

const CSV_PATH = 'inscritos.csv';
const CSV_HEADER = 'data,canal,contato,origem';

export type Canal = 'email' | 'whatsapp';

export type NovoInscrito = {
  canal: Canal;
  contato: string; // já normalizado (validar antes com normalizarContato)
  origem: string;
};

export type ResultadoInscricao = { ok: true; jaExistia: boolean } | { ok: false; erro: string };

/**
 * Valida e normaliza o contato. Retorna null se inválido.
 * E-mail: minúsculo, formato básico. WhatsApp: aceita "(61) 99999-9999",
 * "+55 61 ...", só dígitos etc. e guarda como +55DDDNÚMERO.
 */
export function normalizarContato(canal: Canal, bruto: string): string | null {
  const v = (bruto ?? '').trim();
  if (!v || v.length > 254) return null;

  if (canal === 'email') {
    const email = v.toLowerCase();
    if (!/^[^\s@,"]+@[^\s@,"]+\.[^\s@,"]{2,}$/.test(email)) return null;
    return email;
  }

  // whatsapp
  let d = v.replace(/\D/g, '');
  if (d.startsWith('00')) d = d.slice(2);
  if (d.startsWith('55') && d.length >= 12 && d.length <= 13) d = d.slice(2);
  // nacional: DDD (2 dígitos, 11–99) + 8 ou 9 dígitos
  if (d.length < 10 || d.length > 11) return null;
  const ddd = Number(d.slice(0, 2));
  if (ddd < 11 || ddd > 99) return null;
  // celular de 9 dígitos começa com 9 (WhatsApp é celular)
  if (d.length === 11 && d[2] !== '9') return null;
  return `+55${d}`;
}

/** Campo seguro pra CSV de uma coluna simples: sem vírgula, aspas ou quebra de linha. */
function campoCsv(v: string, max = 120): string {
  return v.replace(/[",\r\n]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}

function linhaCsv(i: NovoInscrito, dataIso: string): string {
  return [dataIso, i.canal, campoCsv(i.contato), campoCsv(i.origem, 80)].join(',');
}

function contatosExistentes(csv: string): Set<string> {
  const set = new Set<string>();
  for (const linha of csv.split('\n')) {
    const cols = linha.split(',');
    if (cols.length >= 3) set.add(cols[2].trim().toLowerCase());
  }
  return set;
}

// ---------- armazenamento: GitHub (produção) ----------

function configGitHub(): { octokit: Octokit; owner: string; repo: string } | null {
  const token = import.meta.env.INSCRITOS_GITHUB_TOKEN;
  if (!token) return null;
  return {
    octokit: new Octokit({ auth: token }),
    owner: import.meta.env.GITHUB_REPO_OWNER || 'joaoandradeaz-eng',
    repo: import.meta.env.INSCRITOS_REPO || 'o-cobogo-inscritos',
  };
}

async function salvarNoGitHub(inscrito: NovoInscrito): Promise<ResultadoInscricao> {
  const cfg = configGitHub();
  if (!cfg) return { ok: false, erro: 'Cadastro indisponível no momento.' };
  const { octokit, owner, repo } = cfg;
  const dataIso = new Date().toISOString();

  // Append com controle de versão (sha). Se duas inscrições chegarem juntas,
  // a segunda leva 409 e a gente relê e tenta de novo.
  for (let tentativa = 0; tentativa < 3; tentativa++) {
    let csv = `${CSV_HEADER}\n`;
    let sha: string | undefined;
    try {
      const res = await octokit.rest.repos.getContent({ owner, repo, path: CSV_PATH });
      if (!Array.isArray(res.data) && res.data.type === 'file') {
        csv = Buffer.from(res.data.content, 'base64').toString('utf-8');
        sha = res.data.sha;
      }
    } catch (err: any) {
      if (err.status !== 404) throw err;
    }

    if (contatosExistentes(csv).has(inscrito.contato.toLowerCase())) {
      return { ok: true, jaExistia: true };
    }

    const novoCsv = `${csv.replace(/\n+$/, '')}\n${linhaCsv(inscrito, dataIso)}\n`;
    try {
      await octokit.rest.repos.createOrUpdateFileContents({
        owner,
        repo,
        path: CSV_PATH,
        message: `Novo inscrito (${inscrito.canal})`,
        content: Buffer.from(novoCsv, 'utf-8').toString('base64'),
        sha,
      });
      return { ok: true, jaExistia: false };
    } catch (err: any) {
      if (err.status === 409 && tentativa < 2) continue;
      throw err;
    }
  }
  return { ok: false, erro: 'Não consegui salvar agora. Tenta de novo?' };
}

// ---------- armazenamento: arquivo local (só dev) ----------

async function salvarLocal(inscrito: NovoInscrito): Promise<ResultadoInscricao> {
  const { mkdir, readFile, appendFile, writeFile } = await import('node:fs/promises');
  const dir = new URL('../../.data/', import.meta.url);
  const arquivo = new URL('inscritos.local.csv', dir);
  await mkdir(dir, { recursive: true });
  let csv = '';
  try {
    csv = await readFile(arquivo, 'utf-8');
  } catch {
    await writeFile(arquivo, `${CSV_HEADER}\n`, 'utf-8');
  }
  if (contatosExistentes(csv).has(inscrito.contato.toLowerCase())) {
    return { ok: true, jaExistia: true };
  }
  await appendFile(arquivo, `${linhaCsv(inscrito, new Date().toISOString())}\n`, 'utf-8');
  return { ok: true, jaExistia: false };
}

export async function salvarInscrito(inscrito: NovoInscrito): Promise<ResultadoInscricao> {
  if (configGitHub()) return salvarNoGitHub(inscrito);
  if (import.meta.env.DEV) return salvarLocal(inscrito);
  return { ok: false, erro: 'Cadastro indisponível no momento.' };
}
