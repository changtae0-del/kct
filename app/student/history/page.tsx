export const dynamic = 'force-dynamic'
import Link from 'next/link'
import { createServerSupabase } from '@/lib/supabase-server'
import {
  getKoreaDateString,
  previousKoreaDate,
  formatKoreaDateLabelFromYmd,
} from '@/lib/korea-date'

export default async function HistoryPage() {
  const db = createServerSupabase()

  const { data: sessions } = await db
    .from('study_sessions')
    .select('*')
    .eq('is_completed', true)
    .order('session_date', { ascending: false })
    .limit(30)

  // Streak calculation
  let streak = 0
  if (sessions && sessions.length > 0) {
    const dates = [...new Set(sessions.map((s) => s.session_date))].sort().reverse()
    const today = getKoreaDateString()
    let current = today
    for (const date of dates) {
      if (date === current) {
        streak++
        current = previousKoreaDate(current)
      } else break
    }
  }

  const totalAnswered = sessions?.reduce((s, r) => s + r.total_questions, 0) || 0
  const totalCorrect = sessions?.reduce((s, r) => s + r.correct_count, 0) || 0
  const overallPct = totalAnswered > 0 ? Math.round((totalCorrect / totalAnswered) * 1000) / 10 : 0

  return (
    <div className="min-h-screen px-4 py-8 max-w-lg mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <Link href="/student/today" className="text-slate-400 hover:text-white">← 오늘 학습</Link>
        <h1 className="text-2xl font-bold text-white">학습 기록</h1>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3 mb-8">
        <div className="bg-slate-800 rounded-xl p-4 text-center">
          <div className="text-3xl font-bold text-orange-400">{streak}</div>
          <div className="text-xs text-slate-400 mt-1">🔥 연속 학습</div>
        </div>
        <div className="bg-slate-800 rounded-xl p-4 text-center">
          <div className="text-3xl font-bold text-blue-400">{totalAnswered}</div>
          <div className="text-xs text-slate-400 mt-1">📝 총 문제 수</div>
        </div>
        <div className="bg-slate-800 rounded-xl p-4 text-center">
          <div className="text-3xl font-bold text-green-400">{overallPct}%</div>
          <div className="text-xs text-slate-400 mt-1">✅ 정답률</div>
        </div>
      </div>

      {/* Session list */}
      {!sessions || sessions.length === 0 ? (
        <div className="text-center py-12 text-slate-500">
          <div className="text-5xl mb-3">📭</div>
          <p>아직 학습 기록이 없어요</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sessions.map((session) => {
            const pct = session.score_pct || 0
            return (
              <Link key={session.id} href={`/student/results/${session.id}`}>
                <div className="bg-slate-800 rounded-xl p-4 flex items-center gap-4 hover:bg-slate-700 transition-colors">
                  <div
                    className="w-12 h-12 rounded-full flex items-center justify-center font-bold text-sm text-white shrink-0"
                    style={{
                      backgroundColor:
                        pct >= 80 ? '#22c55e' : pct >= 60 ? '#f59e0b' : '#ef4444',
                    }}
                  >
                    {pct}%
                  </div>
                  <div className="flex-1">
                    <div className="text-white font-medium">
                      {formatKoreaDateLabelFromYmd(session.session_date)}
                    </div>
                    <div className="text-slate-400 text-sm">
                      {session.correct_count}/{session.total_questions}문제 정답
                    </div>
                  </div>
                  <span className="text-slate-500 text-sm">→</span>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
