import { NextResponse } from 'next/server'
import { clearRoleCookieOnResponse } from '@/lib/auth'

export async function POST() {
  const response = NextResponse.json({ ok: true })
  return clearRoleCookieOnResponse(response)
}
