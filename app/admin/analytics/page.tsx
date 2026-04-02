export const dynamic = 'force-dynamic'
import { createServerSupabase } from '@/lib/supabase-server'
import { getKoreaDateString, previousKoreaDate } from '@/lib/korea-date'
import { SubjectStat, DailyScoreTrend } from '@/types'

async function getAnalytics() {
  const db = createServerSupabase()

  const [subjectStats, dailyTrend, sessions] = await Promise.all([
    db.from('subject_stats').select('*'),
    db
      .from('daily_score_trend')
      .select('*')
      .order('session_date', { ascending: true })
      .limit(30),
    db
      .from('study_sessions')
      .select('*')
      .eq('is_completed', true)
      .order('session_date', { ascending: false }),
  ])

  const allSessions = sessions.data || []
  const totalAnswered = allSessions.reduce((s, r) => s + r.total_questions, 0)
  const totalCorrect = allSessions.reduce((s, r) => s + r.correct_count, 0)
  const overallPct = totalAnswered > 0 ? Math.round((totalCorrect / totalAnswered) * 1000) / 10 : 0

  let streak = 0
  if (allSessions.length > 0) {
    const dates = [...new Set(allSessions.map((s) => s.session_date))].sort().reverse()
    const today = getKoreaDateString()
    let current = today
    for (const date of dates) {
      if (date === current) {
        streak++
        current = previousKoreaDate(current)
      } else break
    }
  }

  return {
    subjectStats: (subjectStats.data || []) as SubjectStat[],
    dailyTrend: (dailyTrend.data || []) as DailyScoreTrend[],
    summary: { totalAnswered, totalCorrect, overallPct, streak, totalSessions: allSessions.length },
  }
}

function SubjectBar({ stat }: { stat: SubjectStat }) {
  const pct = stat.correct_pct || 0
  return (
    <div>
      <div className="flex justify-between text-sm mb-1.5">
        <span className="font-medium" style={{ color: stat.color_hex }}>{stat.subject_name}</span>
        <span className="text-slate-300">{stat.correct_count}/{stat.total_answered} ({pct}%)</span>
      </div>
      <div className="h-3 bg-slate-700 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, backgroundColor: stat.color_hex }}
        />
      </div>
    </div>
  )
}

function DailyVerticalBarChart({ data }: { data: DailyScoreTrend[] }) {
  if (data.length === 0) {
    return <div className="flex items-center justify-center h-40 text-slate-500 text-sm">데이터가 부족합니다</div>
  }

  return (
    <div className="space-y-3">
      <div className="h-48 grid grid-rows-4 rounded-lg border border-slate-700 p-2">
        <div className="border-b border-slate-700/70" />
        <div className="border-b border-slate-700/70" />
        <div className="border-b border-slate-700/70" />
        <div />
        <div className="row-span-4 -mt-48 h-48 overflow-x-auto overflow-y-hidden">
          <div className="h-full min-w-max flex items-end gap-2 px-1">
            {data.map((d) => {
              const pct = Math.max(0, Math.min(100, d.daily_correct_pct || 0))
              const height = Math.max(6, Math.round((pct / 100) * 176))
              return (
                <div key={d.session_date} className="w-9 shrink-0 flex flex-col items-center justify-end">
                  <span className="text-[10px] text-slate-400 mb-1">{pct}%</span>
                  <div
                    className="w-full rounded-t-md bg-indigo-500/90 hover:bg-indigo-400 transition-colors"
                    style={{ height }}
                    title={`${d.session_date}: ${pct}%`}
                  />
                </div>
              )
            })}
          </div>
        </div>
      </div>
      <div className="overflow-x-auto">
        <div className="min-w-max flex gap-2 px-1">
          {data.map((d) => (
            <div key={d.session_date} className="w-9 shrink-0 text-center text-[10px] text-slate-500">
              {d.session_date.slice(5)}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default async function AnalyticsPage() {
  const { subjectStats, dailyTrend, summary } = await getAnalytics()

  const weakSubjects = subjectStats
    .filter((s) => s.total_answered > 0)
    .sort((a, b) => (a.correct_pct || 0) - (b.correct_pct || 0))
    .slice(0, 3)

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-white">성적 분석</h1>

      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: '총 문제 수', value: summary.totalAnswered, unit: '개', icon: '📝' },
          { label: '정답률', value: `${summary.overallPct}`, unit: '%', icon: '✅' },
          { label: '연속 학습', value: summary.streak, unit: '일', icon: '🔥' },
          { label: '총 세션', value: summary.totalSessions, unit: '회', icon: '📚' },
        ].map((card) => (
          <div key={card.label} className="bg-slate-800 rounded-xl p-4">
            <div className="text-2xl mb-1">{card.icon}</div>
            <div className="text-2xl font-bold text-white">{card.value}<span className="text-sm text-slate-400 ml-1">{card.unit}</span></div>
            <div className="text-slate-400 text-xs mt-1">{card.label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Daily vertical bar chart */}
        <div className="bg-slate-800 rounded-xl p-5">
          <h2 className="font-semibold text-white mb-4">날짜별 정답률 (수직그래프)</h2>
          <DailyVerticalBarChart data={dailyTrend} />
        </div>

        {/* Weak subjects */}
        <div className="bg-slate-800 rounded-xl p-5">
          <h2 className="font-semibold text-white mb-4">⚠️ 취약 과목</h2>
          {weakSubjects.length === 0 ? (
            <p className="text-slate-500 text-sm">데이터가 부족합니다</p>
          ) : (
            <div className="space-y-4">
              {weakSubjects.map((s) => (
                <div key={s.subject_id} className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: s.color_hex }} />
                  <div className="flex-1">
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-slate-200">{s.subject_name}</span>
                      <span className="text-slate-400">{s.correct_pct}%</span>
                    </div>
                    <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${s.correct_pct}%`, backgroundColor: s.color_hex }}
                      />
                    </div>
                  </div>
                </div>
              ))}
              <p className="text-slate-500 text-xs mt-2">이 과목들에 더 많은 문제를 배정해보세요</p>
            </div>
          )}
        </div>
      </div>

      {/* Subject breakdown */}
      <div className="bg-slate-800 rounded-xl p-5">
        <h2 className="font-semibold text-white mb-5">과목별 정답률</h2>
        {subjectStats.filter((s) => s.total_answered > 0).length === 0 ? (
          <p className="text-slate-500 text-sm">아직 학습 데이터가 없습니다</p>
        ) : (
          <div className="grid grid-cols-2 gap-x-8 gap-y-4">
            {subjectStats.filter((s) => s.total_answered > 0).map((s) => (
              <SubjectBar key={s.subject_id} stat={s} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
