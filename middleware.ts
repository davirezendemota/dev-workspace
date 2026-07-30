import { NextResponse, type NextRequest } from 'next/server';

import { isAuthorizedBearer } from '@/app/lib/api-bearer-edge';

function isSameOrigin(request: NextRequest): boolean {
  const host = request.headers.get('host');
  if (!host) {
    return false;
  }

  const origin = request.headers.get('origin');
  if (origin) {
    try {
      return new URL(origin).host === host;
    } catch {
      return false;
    }
  }

  const secFetchSite = request.headers.get('sec-fetch-site');
  if (secFetchSite === 'same-origin') {
    return true;
  }

  const referer = request.headers.get('referer');
  if (referer) {
    try {
      return new URL(referer).host === host;
    } catch {
      return false;
    }
  }

  return false;
}

function extractBearerToken(request: NextRequest): string | null {
  const header = request.headers.get('authorization');
  if (!header?.startsWith('Bearer ')) {
    return null;
  }
  const token = header.slice('Bearer '.length).trim();
  return token || null;
}

export function middleware(request: NextRequest) {
  if (!request.nextUrl.pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  if (isSameOrigin(request)) {
    return NextResponse.next();
  }

  const token = extractBearerToken(request);
  if (!token) {
    return NextResponse.json(
      {
        detail:
          'Unauthorized. Use Authorization: Bearer <DEV_WORKSPACE_API_TOKEN>.',
      },
      { status: 401 },
    );
  }

  // Admin token: full gate here. Consumer tokens validated in API routes (filesystem index).
  if (isAuthorizedBearer(token)) {
    return NextResponse.next();
  }

  // Consumer or unknown bearer — let routes validate (consumer index on disk).
  if (token.length >= 32) {
    return NextResponse.next();
  }

  return NextResponse.json(
    {
      detail:
        'Unauthorized. Use Authorization: Bearer <DEV_WORKSPACE_API_TOKEN>.',
    },
    { status: 401 },
  );
}

export const config = {
  matcher: '/api/:path*',
};
