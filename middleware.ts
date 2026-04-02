import { NextRequest, NextResponse } from 'next/server'
import { getRoleFromRequest } from './lib/auth'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (pathname.startsWith('/admin')) {
    const role = await getRoleFromRequest(request)
    if (role !== 'admin') {
      return NextResponse.redirect(new URL('/login', request.url))
    }
  }

  if (pathname.startsWith('/student')) {
    const role = await getRoleFromRequest(request)
    if (role !== 'student') {
      return NextResponse.redirect(new URL('/login', request.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/admin/:path*', '/student/:path*'],
}
