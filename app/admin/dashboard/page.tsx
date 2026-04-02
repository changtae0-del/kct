export const dynamic = 'force-dynamic'
import Link from 'next/link'
import { createServerSupabase } from '@/lib/supabase-server'
import { getKoreaDateString, formatKoreaDateLong } from '@/lib/korea-date'
import RunDailyGenerationButton from '@/components/admin/RunDailyGenerationButton'
import TriggerVercelDeployButton from '@/components/admin/TriggerVercelDeployButton'

async function getDashboardData() {
  const db = createServerSupabase()
  const today = getKoreaDateString()

  const [questionCount, approvedCount, todaySchedule, recentSessions] = await Promise.all([
    db.from('questions').select('*', { count: 'exact', head: true }),
    db.from('questions').select('*', { count: 'exact', head: true }).eq('is_approved', true),
    db.from('daily_schedules').select('*', { count: 'exact', head: true }).eq('schedule_date', today),
    db
      .from('study_sessions')
      .select('*')
      .eq('is_completed', true)
      .order('session_date', { ascending: false })
      .limit(5),
  ])

  return {
    totalQuestions: questionCount.count || 0,
    approvedQuestions: approvedCount.count || 0,
    todayQuestions: todaySchedule.count || 0,
    recentSessions: recentSessions.data || [],
  }
}

export default async function DashboardPage() {
  const data = await getDashboardData()
  const today = formatKoreaDateLong()

  const cards = [
    { label: '전체 문제 수', value: data.totalQuestions, unit: '문제', icon: '📝', color: 'bg-blue-500/20 border-blue-500/40', href: '/admin/questions' },
    { label: '승인된 문제', value: data.approvedQuestions, unit: '문제', icon: '✅', color: 'bg-green-500/20 border-green-500/40', href: '/admin/questions' },
    { label: '오늘 배정 문제', value: data.todayQuestions, unit: '문제', icon: '📅', color: 'bg-indigo-500/20 border-indigo-500/40', href: '/admin/schedule' },
  ]

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">대시보드</h1>
        <p className="text-slate-400 mt-1">{today}</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {cards.map((card) => (
          <Link key={card.label} href={card.href}>
            <div className={`border rounded-xl p-5 transition-all hover:scale-[1.02] ${card.color}`}>
              <div className="text-3xl mb-2">{card.icon}</div>
              <div className="text-3xl font-bold text-white">{card.value}</div>
              <div className="text-slate-300 text-sm mt-1">{card.label}</div>
            </div>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Quick actions */}
        <div className="bg-slate-800 rounded-xl p-5">
          <h2 className="font-semibold text-white mb-4">빠른 실행</h2>
          <p className="text-slate-500 text-xs mb-3">
            매일 자동 생성은 Vercel Cron이 돌 때만 됩니다. 오늘 배정이 비어 있으면 아래로 수동 실행하거나, Vercel에서 Cron 로그·플랜(실행 시간)을 확인하세요.
          </p>
          <RunDailyGenerationButton />
          <div className="mt-4 pt-4 border-t border-slate-700">
            <TriggerVercelDeployButton />
          </div>
          <div className="space-y-3 mt-4">
            {[
              { href: '/admin/generate', label: 'AI로 문제 생성하기', icon: '🤖' },
              { href: '/admin/questions/new', label: '문제 직접 입력하기', icon: '✏️' },
              { href: '/admin/schedule', label: '오늘 문제 배정하기', icon: '📅' },
              { href: '/admin/analytics', label: '성적 분석 보기', icon: '📈' },
            ].map(({ href, label, icon }) => (
              <Link
                key={href}
                href={href}
                className="flex items-center gap-3 p-3 rounded-lg bg-slate-700 hover:bg-slate-600 transition-colors text-slate-200"
              >
                <span>{icon}</span>
                <span className="text-sm font-medium">{label}</span>
                <span className="ml-auto text-slate-400">→</span>
              </Link>
            ))}
          </div>
        </div>

        {/* Recent sessions */}
        <div className="bg-slate-800 rounded-xl p-5">
          <h2 className="font-semibold text-white mb-4">최근 학습 기록</h2>
          {data.recentSessions.length === 0 ? (
            <p className="text-slate-500 text-sm">아직 학습 기록이 없습니다</p>
          ) : (
            <div className="space-y-3">
              {data.recentSessions.map((session) => (
                <div key={session.id} className="flex items-center justify-between p-3 bg-slate-700 rounded-lg">
                  <div>
                    <div className="text-sm text-slate-200">{session.session_date}</div>
                    <div className="text-xs text-slate-400">{session.total_questions}문제</div>
                  </div>
                  <div className={`text-lg font-bold ${
                    (session.score_pct || 0) >= 80 ? 'text-green-400' :
                    (session.score_pct || 0) >= 60 ? 'text-yellow-400' : 'text-red-400'
                  }`}>
                    {session.score_pct}%
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
