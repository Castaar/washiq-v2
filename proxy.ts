import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/session';

// Public paths that don't require auth
const PUBLIC_PATHS = ['/login', '/api/auth/login'];

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Always allow public paths and Next.js internals
  if (
    PUBLIC_PATHS.some((p) => pathname.startsWith(p)) ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname === '/sw.js' ||
    pathname === '/manifest.webmanifest' ||
    pathname === '/apple-touch-icon.png' ||
    pathname.match(/\.(png|jpg|jpeg|svg|ico|webp|woff2?)$/)
  ) {
    return NextResponse.next();
  }

  const session = await getSessionFromRequest(req);

  if (!session) {
    const loginUrl = req.nextUrl.clone();
    loginUrl.pathname = '/login';
    return NextResponse.redirect(loginUrl);
  }

  // Employees cannot access wekelijkse-ingave, historiek, instellingen, or developer panel
  if (session.role === 'employee') {
    if (pathname.startsWith('/wekelijkse-ingave') || pathname.startsWith('/historiek') || pathname.startsWith('/instellingen')) {
      const url = req.nextUrl.clone();
      url.pathname = '/dagfiche';
      return NextResponse.redirect(url);
    }
    if (pathname.startsWith('/developer')) {
      const url = req.nextUrl.clone();
      url.pathname = '/';
      return NextResponse.redirect(url);
    }
  }

  // Only developers can access the developer panel
  if (pathname.startsWith('/developer') && session.role !== 'developer') {
    const url = req.nextUrl.clone();
    url.pathname = '/';
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
