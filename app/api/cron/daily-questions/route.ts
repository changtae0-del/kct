import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase-server'
import { getKoreaDateString } from '@/lib/korea-date'
import { runDailyAiQuestionJob } from '@/lib/daily-ai-generation'

/** Vercel Pro 등에서 긴 OpenAI 호출 허용 (Hobby 10초 제한 시 실패할 수 있음) */
export const maxDuration = 300

/**
 * Vercel Cron: 매일 23:00 UTC = 한국 다음날 08:00 전후와 맞춤.
 * Authorization: Bearer CRON_SECRET
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    return NextResponse.json({ error: 'CRON_SECRET 환경 변수가 없습니다' }, { status: 500 })
  }

  const auth = request.headers.get('authorization')
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: 'OPENAI_API_KEY 없음' }, { status: 500 })
  }

  const scheduleDate = getKoreaDateString()

  try {
    const db = createServerSupabase()
    const result = await runDailyAiQuestionJob(db, scheduleDate)
    const status = result.errors.length > 0 && result.subjectsOk === 0 ? 500 : 200
    return NextResponse.json(result, { status })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : '실패' },
      { status: 500 }
    )
  }
}
