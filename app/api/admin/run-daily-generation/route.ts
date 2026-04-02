import { NextRequest, NextResponse } from 'next/server'
import { getRoleFromRequest } from '@/lib/auth'
import { createServerSupabase } from '@/lib/supabase-server'
import { getKoreaDateString } from '@/lib/korea-date'
import { runDailyAiQuestionJob } from '@/lib/daily-ai-generation'

/** Cron과 동일 작업. Vercel Hobby는 시간 제한으로 여기서도 실패할 수 있음. */
export const maxDuration = 300

export async function POST(request: NextRequest) {
  if ((await getRoleFromRequest(request)) !== 'admin') {
    return NextResponse.json({ error: '관리자만 실행할 수 있습니다' }, { status: 403 })
  }

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: 'OPENAI_API_KEY 없음' }, { status: 500 })
  }

  try {
    const db = createServerSupabase()
    const scheduleDate = getKoreaDateString()
    const result = await runDailyAiQuestionJob(db, scheduleDate)
    const ok = result.subjectsOk > 0
    return NextResponse.json({ ...result, scheduleDate }, { status: ok ? 200 : 500 })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : '실패' },
      { status: 500 }
    )
  }
}
