import type { APIRoute } from 'astro';
import { setSession, isEmailAllowed } from '../../../lib/session';
import { OAUTH_STATE_COOKIE } from './login';

/** Página de erro simples e amigável (não vaza stack trace pro usuário). */
function errorPage(heading: string, message: string, status: number): Response {
  const html = `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="robots" content="noindex, nofollow" />
  <title>${heading} · O Cobogó</title>
  <style>
    body{font-family:Georgia,'Times New Roman',serif;max-width:520px;margin:18vh auto 0;padding:0 24px;color:#1a1a1a;line-height:1.5}
    .code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;letter-spacing:.16em;text-transform:uppercase;color:#b4926a}
    h1{font-size:30px;line-height:1.1;margin:14px 0 14px}
    p{font-size:17px;color:#444}
    a{display:inline-block;margin-top:24px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;letter-spacing:.1em;text-transform:uppercase;color:#a55b2a;text-decoration:none;border-bottom:1px solid currentColor}
  </style>
</head>
<body>
  <div class="code">O Cobogó · acesso</div>
  <h1>${heading}</h1>
  <p>${message}</p>
  <a href="/">← Voltar ao site</a>
</body>
</html>`;
  return new Response(html, {
    status,
    headers: { 'content-type': 'text/html; charset=utf-8' },
  });
}

export const GET: APIRoute = async ({ url, cookies, redirect }) => {
  const code = url.searchParams.get('code');
  const error = url.searchParams.get('error');
  const returnedState = url.searchParams.get('state');

  // Valida o state anti-CSRF antes de qualquer coisa.
  const expectedState = cookies.get(OAUTH_STATE_COOKIE)?.value;
  cookies.delete(OAUTH_STATE_COOKIE, { path: '/' });
  if (!expectedState || !returnedState || expectedState !== returnedState) {
    return errorPage(
      'Sessão de login expirada',
      'O pedido de login não bateu (pode ter demorado demais ou aberto em outra aba). Tente entrar de novo.',
      400
    );
  }

  if (error) {
    return errorPage('Login cancelado', 'Você cancelou ou negou o acesso no Google. Sem problema — tente de novo quando quiser.', 400);
  }
  if (!code) {
    return errorPage('Login incompleto', 'O Google não devolveu o código de autorização. Tente entrar de novo.', 400);
  }

  const clientId = import.meta.env.GOOGLE_CLIENT_ID;
  const clientSecret = import.meta.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return errorPage('Servidor não configurado', 'As credenciais do Google não estão definidas no servidor.', 500);
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
    return errorPage('Falha ao falar com o Google', 'Não deu pra trocar o código por um token. Tente entrar de novo em alguns instantes.', 502);
  }

  const { access_token } = (await tokenRes.json()) as { access_token: string };

  const userRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${access_token}` },
  });

  if (!userRes.ok) {
    return errorPage('Falha ao ler seu perfil', 'O Google não retornou seus dados de perfil. Tente entrar de novo.', 502);
  }

  const profile = (await userRes.json()) as {
    email: string;
    email_verified: boolean;
    name?: string;
    picture?: string;
  };

  if (!profile.email_verified) {
    return errorPage('Email não verificado', 'Sua conta do Google não tem o email verificado.', 403);
  }

  if (!isEmailAllowed(profile.email)) {
    return errorPage(
      'Acesso restrito',
      'Este painel é só do autor do blog. A conta que você usou não está autorizada.',
      403
    );
  }

  await setSession(cookies, {
    email: profile.email,
    name: profile.name,
    picture: profile.picture,
  });

  return redirect('/admin', 302);
};
