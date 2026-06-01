import type { APIRoute } from 'astro';

export const OAUTH_STATE_COOKIE = 'ocobogo_oauth_state';

export const GET: APIRoute = async ({ url, cookies }) => {
  const clientId = import.meta.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    return new Response('Missing GOOGLE_CLIENT_ID', { status: 500 });
  }

  const redirectUri = `${url.origin}/api/auth/callback`;

  // Token aleatório anti-CSRF: guardado num cookie curto e devolvido pelo Google.
  const state = crypto.randomUUID();
  cookies.set(OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    secure: import.meta.env.PROD,
    sameSite: 'lax',
    path: '/',
    maxAge: 600,
  });

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    access_type: 'online',
    prompt: 'select_account',
    state,
  });

  return new Response(null, {
    status: 302,
    headers: { Location: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}` },
  });
};
