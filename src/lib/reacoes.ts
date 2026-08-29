import { Octokit } from '@octokit/rest';

/**
 * Contadores de reação dos artigos (Adorei / Aplausos / Me fez pensar).
 * Moram num reacoes.json no mesmo repositório PRIVADO dos inscritos,
 * escrito com o mesmo INSCRITOS_GITHUB_TOKEN. Em dev sem token, cai num
 * JSON local (.data/, fora do git).
 */

export const REACOES = ['adorei', 'aplausos', 'pensei'] as const;
export type Reacao = (typeof REACOES)[number];
export type Contagens = Record<string, number>;

const JSON_PATH = 'reacoes.json';

function contagensDoSlug(tudo: Record<string, Contagens>, slug: string): Contagens {
  const c = tudo[slug] ?? {};
  return { adorei: c.adorei ?? 0, aplausos: c.aplausos ?? 0, pensei: c.pensei ?? 0 };
}

function configGitHub(): { octokit: Octokit; owner: string; repo: string } | null {
  const token = import.meta.env.INSCRITOS_GITHUB_TOKEN;
  if (!token) return null;
  return {
    octokit: new Octokit({ auth: token }),
    owner: import.meta.env.GITHUB_REPO_OWNER || 'joaoandradeaz-eng',
    repo: import.meta.env.INSCRITOS_REPO || 'o-cobogo-inscritos',
  };
}

async function lerDoGitHub(): Promise<{ tudo: Record<string, Contagens>; sha?: string }> {
  const cfg = configGitHub();
  if (!cfg) return { tudo: {} };
  try {
    const res = await cfg.octokit.rest.repos.getContent({
      owner: cfg.owner,
      repo: cfg.repo,
      path: JSON_PATH,
    });
    if (Array.isArray(res.data) || res.data.type !== 'file') return { tudo: {} };
    const texto = Buffer.from(res.data.content, 'base64').toString('utf-8');
    return { tudo: JSON.parse(texto || '{}'), sha: res.data.sha };
  } catch (err: any) {
    if (err.status === 404) return { tudo: {} };
    throw err;
  }
}

// ---------- arquivo local (só dev) ----------

async function arquivoLocal(): Promise<URL> {
  const { mkdir } = await import('node:fs/promises');
  const dir = new URL('../../.data/', import.meta.url);
  await mkdir(dir, { recursive: true });
  return new URL('reacoes.local.json', dir);
}

async function lerLocal(): Promise<Record<string, Contagens>> {
  const { readFile } = await import('node:fs/promises');
  try {
    return JSON.parse(await readFile(await arquivoLocal(), 'utf-8'));
  } catch {
    return {};
  }
}

// ---------- API pública ----------

export async function lerReacoes(slug: string): Promise<Contagens> {
  if (configGitHub()) return contagensDoSlug((await lerDoGitHub()).tudo, slug);
  if (import.meta.env.DEV) return contagensDoSlug(await lerLocal(), slug);
  return contagensDoSlug({}, slug);
}

// Fila: gravações em série dentro da mesma instância, senão dois cliques
// quase juntos leem o mesmo estado e um sobrescreve o outro.
let fila: Promise<unknown> = Promise.resolve();

export function registrarReacao(
  slug: string,
  reacao: Reacao,
  delta: 1 | -1
): Promise<Contagens> {
  const exec = () => gravarReacao(slug, reacao, delta);
  const p = fila.then(exec, exec);
  fila = p.catch(() => {});
  return p;
}

async function gravarReacao(
  slug: string,
  reacao: Reacao,
  delta: 1 | -1
): Promise<Contagens> {
  const aplicar = (tudo: Record<string, Contagens>) => {
    const c = contagensDoSlug(tudo, slug);
    c[reacao] = Math.max(0, (c[reacao] ?? 0) + delta);
    tudo[slug] = c;
    return c;
  };

  const cfg = configGitHub();
  if (cfg) {
    // read-modify-write com sha; em corrida (409), relê e tenta de novo
    for (let tentativa = 0; tentativa < 3; tentativa++) {
      const { tudo, sha } = await lerDoGitHub();
      const c = aplicar(tudo);
      try {
        await cfg.octokit.rest.repos.createOrUpdateFileContents({
          owner: cfg.owner,
          repo: cfg.repo,
          path: JSON_PATH,
          message: `Reação: ${reacao} ${delta > 0 ? '+1' : '-1'} em ${slug}`,
          content: Buffer.from(JSON.stringify(tudo, null, 2) + '\n', 'utf-8').toString('base64'),
          sha,
        });
        return c;
      } catch (err: any) {
        if (err.status === 409 && tentativa < 2) continue;
        throw err;
      }
    }
    throw new Error('conflito persistente ao gravar reação');
  }

  if (import.meta.env.DEV) {
    const { writeFile } = await import('node:fs/promises');
    const tudo = await lerLocal();
    const c = aplicar(tudo);
    await writeFile(await arquivoLocal(), JSON.stringify(tudo, null, 2) + '\n', 'utf-8');
    return c;
  }

  throw new Error('sem armazenamento configurado');
}
