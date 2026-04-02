import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { Role } from '@/types'

const COOKIE_NAME = 'gk_role'
const secret = new TextEncoder().encode(
  process.env.AUTH_SECRET || 'fallback-secret-change-in-production'
)

export async function signRoleCookie(role: Role): Promise<string> {
  return new SignJWT({ role })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('7d')
    .sign(secret)
}

export async function verifyRoleCookie(token: string): Promise<Role | null> {
  try {
    const { payload } = await jwtVerify(token, secret)
    return (payload.role as Role) || null
  } catch {
    return null
  }
}

export async function getRoleFromRequest(request: NextRequest): Promise<Role | null> {
  const token = request.cookies.get(COOKIE_NAME)?.value
  if (!token) return null
  return verifyRoleCookie(token)
}

export async function getRoleFromCookies(): Promise<Role | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE_NAME)?.value
  if (!token) return null
  return verifyRoleCookie(token)
}

/** 임베드(앱 모음 iframe, file:// 부모 등)에서도 로그인 유지하려면 Strict 대신 None+Secure 필요 */
function sessionCookieAttributes(): {
  httpOnly: true
  secure: boolean
  sameSite: 'lax' | 'none'
  path: '/'
} {
  const isProd = process.env.NODE_ENV === 'production'
  return {
    httpOnly: true,
    path: '/',
    secure: isProd,
    sameSite: isProd ? 'none' : 'lax',
  }
}

export function setRoleCookieOnResponse(response: NextResponse, token: string): NextResponse {
  response.cookies.set(COOKIE_NAME, token, {
    ...sessionCookieAttributes(),
    maxAge: 60 * 60 * 24 * 7, // 7 days
  })
  return response
}

export function clearRoleCookieOnResponse(response: NextResponse): NextResponse {
  response.cookies.set(COOKIE_NAME, '', {
    ...sessionCookieAttributes(),
    maxAge: 0,
  })
  return response
}
