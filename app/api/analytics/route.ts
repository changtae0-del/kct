import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase-server'
import { getKoreaDateString, previousKoreaDate } from '@/lib/korea-date'

export async function GET() {
  const db = createServerSupabase()

  const [subjectStats, dailyTrend, recentSessions, overallStats] = await Promise.all([
    db.from('subject_stats').select('*'),
    db
      .from('daily_score_trend')
      .select('*')
      .order('session_date', { ascending: false })
      .limit(30),
    db
      .from('study_sessions')
      .select('*')
      .eq('is_completed', true)
      .order('session_date', { ascending: false })
      .limit(10),
    db
      .from('study_sessions')
      .select('total_questions, correct_count, session_date')
      .eq('is_completed', true),
  ])

  // Calculate streak
  let streak = 0
  if (overallStats.data) {
    const dates = [...new Set(overallStats.data.map((s) => s.session_date))].sort().reverse()
    const today = getKoreaDateString()
    let current = today
    for (const date of dates) {
      if (date === current) {
        streak++
        current = previousKoreaDate(current)
      } else {
        break
      }
    }
  }

  // Overall totals
  const totalAnswered = overallStats.data?.reduce((s, r) => s + r.total_questions, 0) || 0
  const totalCorrect = overallStats.data?.reduce((s, r) => s + r.correct_count, 0) || 0
  const overallPct = totalAnswered > 0 ? Math.round((totalCorrect / totalAnswered) * 1000) / 10 : 0

  return NextResponse.json({
    subjectStats: subjectStats.data || [],
    dailyTrend: (dailyTrend.data || []).reverse(),
    recentSessions: recentSessions.data || [],
    summary: {
      totalAnswered,
      totalCorrect,
      overallPct,
      streak,
      totalSessions: overallStats.data?.length || 0,
    },
  })
}
