import * as Linking from 'expo-linking';

/** Route Expo Router à ouvrir lorsqu'un lien GBONHI FOOT arrive dans l'app. */
export function routeFromGbonhiLink(url: string): string | null {
  const parsed = Linking.parse(url);
  if (parsed.scheme !== 'gbonhi') return null;

  const host = parsed.hostname?.toLowerCase();
  const path = (parsed.path ?? '').replace(/^\/+|\/+$/g, '');

  if (host === 'team' && path === 'join') {
    const code = parsed.queryParams?.code;
    return typeof code === 'string' && code.trim()
      ? `/team/join?code=${encodeURIComponent(code.trim())}`
      : '/team/join';
  }

  if (host === 'match' && path) return `/match/${encodeURIComponent(path.split('/')[0])}`;
  if (host === 'post' && path) return `/community/${encodeURIComponent(path.split('/')[0])}`;

  return null;
}
