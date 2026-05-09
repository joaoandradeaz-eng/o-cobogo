import type { APIRoute } from 'astro';
import { setSession } from '../../../lib/session';

export const GET: APIRoute = async ({ url, cookies, redirect }) => {
  const code = url.searchParams.get('code');
  const error = url.searchParams.get('error');

  if (error) {
    return new Response(`Google auth error: ${error}`, { status: 400 });
  }
  if (!code) {
    return new Response('Missing code', { status: 400 });
  }

  const clientId = import.meta.env.GOOGLE_CLIENT_ID;
  const clientSecret = import.meta.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return new Response('Server misconfigured', { status: 500 });
  }

  const redirectUri = `${url.origin}/api/auth/callback`;

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  });

  if (!tokenRes.ok) {
    const text = await tokenRes.text();
    return new Response(`Token exchange failed: ${text}`, { status: 502 });
  }

  const { access_token } = (await tokenRes.json()) as { access_token: string };

  const userRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${access_token}` },
  });

  if (!userRes.ok) {
    return new Response('Failed to fetch user info', { status: 502 });
  }

  const profile = (await userRes.json()) as {
    email: string;
    email_verified: boolean;
    name?: string;
    picture?: string;
  };

  if (!profile.email_verified) {
    return new Response('Email not verified', { status: 403 });
  }

  if (profile.email !== 'joaoandradeaz@gmail.com') {
    return new Response('Acesso negado: este email não está autorizado.', { status: 403 });
  }

  await setSession(cookies, {
    email: profile.email,
    name: profile.name,
    picture: profile.picture,
  });

  return redirect('/admin', 302);
};
