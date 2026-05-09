import type { APIRoute } from 'astro';
import { getSession, isAuthorized } from '../../../lib/session';
import { slugify } from '../../../lib/slug';
import { htmlToMarkdown, buildMarkdownFile, type PostFrontmatter } from '../../../lib/markdown';
import { createFile, fileExists } from '../../../lib/github';

const VALID_CATEGORIES = ['ensaio', 'reportagem', 'critica', 'entrevista', 'memoria', 'cidade-casa'];

type CreateBody = {
  title?: string;
  dek?: string;
  categories?: string[];
  date?: string;
  readTime?: string;
  draft?: boolean;
  bodyHtml?: string;
};

export const POST: APIRoute = async ({ request, cookies }) => {
  const session = await getSession(cookies);
  if (!isAuthorized(session)) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 });
  }

  let body: CreateBody;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'invalid json' }), { status: 400 });
  }

  const errors: string[] = [];
  if (!body.title?.trim()) errors.push('title is required');
  if (!body.dek?.trim()) errors.push('dek is required');
  if (!body.categories?.length) errors.push('at least one category is required');
  if (body.categories?.some((c) => !VALID_CATEGORIES.includes(c))) errors.push('invalid category');
  if (!body.date?.trim()) errors.push('date is required');
  if (!body.readTime?.trim()) errors.push('readTime is required');
  if (!body.bodyHtml?.trim()) errors.push('body is empty');

  if (errors.length) {
    return new Response(JSON.stringify({ error: errors.join('; ') }), { status: 400 });
  }

  const slug = slugify(body.title!);
  if (!slug) {
    return new Response(JSON.stringify({ error: 'could not derive slug from title' }), { status: 400 });
  }

  const path = `src/content/articles/${slug}.md`;

  if (await fileExists(path)) {
    return new Response(
      JSON.stringify({ error: `Já existe um artigo com slug "${slug}". Mude o título.` }),
      { status: 409 }
    );
  }

  const frontmatter: PostFrontmatter = {
    title: body.title!.trim(),
    dek: body.dek!.trim(),
    categories: body.categories!,
    date: body.date!,
    readTime: body.readTime!.trim(),
    draft: body.draft ?? false,
  };

  const markdownBody = htmlToMarkdown(body.bodyHtml!);
  const fileContent = buildMarkdownFile(frontmatter, markdownBody);
  const commitMessage = `post: ${frontmatter.title}${frontmatter.draft ? ' (draft)' : ''}`;

  try {
    const result = await createFile(path, fileContent, commitMessage);
    return new Response(
      JSON.stringify({ ok: true, slug, path, commitSha: result.commitSha }),
      { status: 201, headers: { 'content-type': 'application/json' } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: `GitHub commit failed: ${err.message ?? String(err)}` }),
      { status: 502 }
    );
  }
};
