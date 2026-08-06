import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';

type CookieItem = { name: string; value: string; options: CookieOptions };

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet: CookieItem[]) => {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );

  // Ne pas interroger Supabase Auth à chaque navigation : le backend valide
  // ensuite le JWT présenté sur /users/me avant de rendre le back-office.
  const { data: { session } } = await supabase.auth.getSession();
  const hasSession = Boolean(session?.access_token);
  // Pages publiques (accessibles sans session) : connexion + récupération de mot
  // de passe. Sans ça, /forgot-password et /reset-password étaient renvoyés vers
  // /login → le lien « Mot de passe oublié » et le lien e-mail ne fonctionnaient pas.
  const PUBLIC_PATHS = ['/login', '/forgot-password', '/reset-password'];
  const isPublicPage = PUBLIC_PATHS.some((p) => request.nextUrl.pathname.startsWith(p));

  if (!hasSession && !isPublicPage) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
