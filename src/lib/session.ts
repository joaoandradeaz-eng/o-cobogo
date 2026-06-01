import { sealData, unsealData } from 'iron-session';
import type { AstroCookies } from 'astro';

export type SessionData = {
  email: string;
  name?: string;
  picture?: string;
};

const COOKIE_NAME = 'ocobogo_session';
const ALLOWED_EMAIL = 'joaoandradeaz@gmail.com';
const TTL_SECONDS = 60 * 60 * 24 * 30;

function getSecret(): string {
  const secret = import.meta.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('SESSION_SECRET missing or too short');
  }
  return secret;
}

export async function setSession(cookies: AstroCookies, data: SessionData): Promise<void> {
  const sealed = await sealData(data, { password: getSecret(), ttl: TTL_SECONDS });
  cookies.set(COOKIE_NAME, sealed, {
    httpOnly: true,
    secure: import.meta.env.PROD,
    sameSite: 'lax',
    path: '/',
    maxAge: TTL_SECONDS,
  });
}

export async function getSession(cookies: AstroCookies): Promise<SessionData | null> {
  const raw = cookies.get(COOKIE_NAME)?.value;
  if (!raw) return null;
  try {
    return await unsealData<SessionData>(raw, { password: getSecret(), ttl: TTL_SECONDS });
  } catch {
    return null;
  }
}

export function clearSession(cookies: AstroCookies): void {
  cookies.delete(COOKIE_NAME, { path: '/' });
}

/** Fonte única de verdade de quem pode entrar no admin. */
export function isEmailAllowed(email: string | undefined | null): boolean {
  return !!email && email === ALLOWED_EMAIL;
}

export function isAuthorized(session: SessionData | null): session is SessionData {
  return isEmailAllowed(session?.email);
}
