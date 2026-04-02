import { NextRequest, NextResponse } from 'next/server'
import { signRoleCookie, setRoleCookieOnResponse } from '@/lib/auth'
import { Role } from '@/types'

export async function POST(request: NextRequest) {
  const { role, password } = await request.json()

  let isValid = false
  if (role === 'admin' && password === process.env.ADMIN_PASSWORD) {
    isValid = true
  } else if (role === 'student' && password === process.env.STUDENT_PASSWORD) {
    isValid = true
  }

  if (!isValid) {
    return NextResponse.json({ error: '비밀번호가 올바르지 않습니다' }, { status: 401 })
  }

  const token = await signRoleCookie(role as Role)
  const response = NextResponse.json({ ok: true, role })
  return setRoleCookieOnResponse(response, token)
}
