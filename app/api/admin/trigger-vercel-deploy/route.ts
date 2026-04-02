import { NextRequest, NextResponse } from 'next/server'
import { getRoleFromRequest } from '@/lib/auth'

/**
 * Vercel Deploy Hook URL로 프로덕션 배포를 시작합니다.
 * 프로젝트 설정 > Git > Deploy Hooks 에서 훅을 만들고
 * VERCEL_DEPLOY_HOOK_URL 환경 변수에 전체 URL을 넣으세요.
 */
export async function POST(request: NextRequest) {
  if ((await getRoleFromRequest(request)) !== 'admin') {
    return NextResponse.json({ error: '관리자만 실행할 수 있습니다' }, { status: 403 })
  }

  const hook = process.env.VERCEL_DEPLOY_HOOK_URL
  if (!hook || !hook.startsWith('https://')) {
    return NextResponse.json(
      {
        error:
          'VERCEL_DEPLOY_HOOK_URL 이 설정되지 않았습니다. Vercel 대시보드에서 Deploy Hook을 만들고 환경 변수로 넣어주세요.',
      },
      { status: 500 }
    )
  }

  try {
    const res = await fetch(hook, { method: 'POST', cache: 'no-store' })
    const text = await res.text()
    let parsed: unknown
    try {
      parsed = JSON.parse(text)
    } catch {
      parsed = { raw: text.slice(0, 500) }
    }

    if (!res.ok) {
      return NextResponse.json(
        { error: 'Vercel Deploy Hook 요청 실패', status: res.status, detail: parsed },
        { status: 502 }
      )
    }

    return NextResponse.json({ ok: true, vercel: parsed })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : '요청 실패' },
      { status: 500 }
    )
  }
}
