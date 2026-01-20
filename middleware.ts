import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // Only apply to API routes
  if (!request.nextUrl.pathname.startsWith('/api')) {
    return NextResponse.next();
  }

  const response = NextResponse.next();

  // Add security headers
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // CORS - only allow same origin for API routes
  const origin = request.headers.get('origin');
  const host = request.headers.get('host');
  
  // Allow requests from same origin or no origin (same-site requests)
  if (origin) {
    // Extract hostname from origin
    try {
      const originUrl = new URL(origin);
      const hostWithoutPort = host?.split(':')[0];
      const originHostWithoutPort = originUrl.hostname;
      
      // Allow if origins match or if it's localhost in development
      if (originHostWithoutPort === hostWithoutPort || 
          (process.env.NODE_ENV === 'development' && originHostWithoutPort === 'localhost')) {
        response.headers.set('Access-Control-Allow-Origin', origin);
        response.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        response.headers.set('Access-Control-Allow-Headers', 'Content-Type');
      }
    } catch {
      // Invalid origin URL, don't set CORS headers
    }
  }

  // Handle preflight requests
  if (request.method === 'OPTIONS') {
    return new NextResponse(null, {
      status: 200,
      headers: response.headers,
    });
  }

  return response;
}

export const config = {
  matcher: '/api/:path*',
};

