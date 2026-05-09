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
    committer: { name: 'O Cobogó Admin', email: 'joaoandradeaz@gmail.com' },
    author: { name: 'O Cobogó Admin', email: 'joaoandradeaz@gmail.com' },
  });

  return {
    sha: res.data.content?.sha ?? '',
    commitSha: res.data.commit.sha ?? '',
  };
}
