import { Octokit } from '@octokit/rest';

function getOctokit(): Octokit {
  const token = import.meta.env.GITHUB_TOKEN;
  if (!token) throw new Error('GITHUB_TOKEN missing');
  return new Octokit({ auth: token });
}

function getRepo(): { owner: string; repo: string } {
  const owner = import.meta.env.GITHUB_REPO_OWNER;
  const repo = import.meta.env.GITHUB_REPO_NAME;
  if (!owner || !repo) throw new Error('GITHUB_REPO_OWNER or GITHUB_REPO_NAME missing');
  return { owner, repo };
}

const COMMITTER = { name: 'O Cobogó Admin', email: 'joaoandradeaz@gmail.com' };

export async function fileExists(path: string): Promise<boolean> {
  const octokit = getOctokit();
  const { owner, repo } = getRepo();
  try {
    await octokit.rest.repos.getContent({ owner, repo, path });
    return true;
  } catch (err: any) {
    if (err.status === 404) return false;
    throw err;
  }
}

export async function getFile(path: string): Promise<{ content: string; sha: string } | null> {
  const octokit = getOctokit();
  const { owner, repo } = getRepo();
  try {
    const res = await octokit.rest.repos.getContent({ owner, repo, path });
    if (Array.isArray(res.data) || res.data.type !== 'file') {
      throw new Error(`Path ${path} is not a file`);
    }
    const content = Buffer.from(res.data.content, res.data.encoding as BufferEncoding).toString('utf-8');
    return { content, sha: res.data.sha };
  } catch (err: any) {
    if (err.status === 404) return null;
    throw err;
  }
}

export async function listDirectory(dirPath: string): Promise<Array<{ name: string; path: string; sha: string }>> {
  const octokit = getOctokit();
  const { owner, repo } = getRepo();
  try {
    const res = await octokit.rest.repos.getContent({ owner, repo, path: dirPath });
    if (!Array.isArray(res.data)) return [];
    return res.data
      .filter((item: any) => item.type === 'file')
      .map((item: any) => ({ name: item.name, path: item.path, sha: item.sha }));
  } catch (err: any) {
    if (err.status === 404) return [];
    throw err;
  }
}

export async function createFile(
  path: string,
  content: string,
  commitMessage: string
): Promise<{ sha: string; commitSha: string }> {
  const octokit = getOctokit();
  const { owner, repo } = getRepo();

  const res = await octokit.rest.repos.createOrUpdateFileContents({
    owner,
    repo,
    path,
    message: commitMessage,
    content: Buffer.from(content, 'utf-8').toString('base64'),
    committer: COMMITTER,
    author: COMMITTER,
  });

  return {
    sha: res.data.content?.sha ?? '',
    commitSha: res.data.commit.sha ?? '',
  };
}

export async function updateFile(
  path: string,
  content: string,
  sha: string,
  commitMessage: string
): Promise<{ sha: string; commitSha: string }> {
  const octokit = getOctokit();
  const { owner, repo } = getRepo();

  const res = await octokit.rest.repos.createOrUpdateFileContents({
    owner,
    repo,
    path,
    message: commitMessage,
    content: Buffer.from(content, 'utf-8').toString('base64'),
    sha,
    committer: COMMITTER,
    author: COMMITTER,
  });

  return {
    sha: res.data.content?.sha ?? '',
    commitSha: res.data.commit.sha ?? '',
  };
}

export async function deleteFile(
  path: string,
  sha: string,
  commitMessage: string
): Promise<{ commitSha: string }> {
  const octokit = getOctokit();
  const { owner, repo } = getRepo();
  const res = await octokit.rest.repos.deleteFile({
    owner,
    repo,
    path,
    message: commitMessage,
    sha,
    committer: COMMITTER,
    author: COMMITTER,
  });
  return { commitSha: res.data.commit.sha ?? '' };
}

/**
 * Commit múltiplos arquivos atomicamente via tree API.
 * Cada file: { path, content (string), action: 'upsert' | 'delete' }
 * Pra delete, content é ignorado (passa sha=null no tree).
 */
export async function multiFileCommit(
  files: Array<{ path: string; content?: string; action?: 'upsert' | 'delete' }>,
  commitMessage: string
): Promise<{ commitSha: string }> {
  const octokit = getOctokit();
  const { owner, repo } = getRepo();

  // 1. Pega o SHA do HEAD da branch default
  const repoInfo = await octokit.rest.repos.get({ owner, repo });
  const defaultBranch = repoInfo.data.default_branch;
  const ref = await octokit.rest.git.getRef({ owner, repo, ref: `heads/${defaultBranch}` });
  const headSha = ref.data.object.sha;
  const headCommit = await octokit.rest.git.getCommit({ owner, repo, commit_sha: headSha });
  const baseTreeSha = headCommit.data.tree.sha;

  // 2. Cria blobs para cada arquivo upsert; deletes ficam com sha=null
  const treeItems = await Promise.all(
    files.map(async (f) => {
      if (f.action === 'delete') {
        return { path: f.path, mode: '100644' as const, type: 'blob' as const, sha: null };
      }
      const blob = await octokit.rest.git.createBlob({
        owner,
        repo,
        content: Buffer.from(f.content ?? '', 'utf-8').toString('base64'),
        encoding: 'base64',
      });
      return { path: f.path, mode: '100644' as const, type: 'blob' as const, sha: blob.data.sha };
    })
  );

  // 3. Cria a nova tree
  const tree = await octokit.rest.git.createTree({
    owner,
    repo,
    base_tree: baseTreeSha,
    tree: treeItems as any,
  });

  // 4. Cria o commit apontando pra nova tree
  const commit = await octokit.rest.git.createCommit({
    owner,
    repo,
    message: commitMessage,
    tree: tree.data.sha,
    parents: [headSha],
    committer: COMMITTER,
    author: COMMITTER,
  });

  // 5. Atualiza a ref pro novo commit
  await octokit.rest.git.updateRef({
    owner,
    repo,
    ref: `heads/${defaultBranch}`,
    sha: commit.data.sha,
  });

  return { commitSha: commit.data.sha };
}
