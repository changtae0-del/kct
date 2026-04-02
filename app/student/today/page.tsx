export const dynamic = 'force-dynamic'
import Link from 'next/link'
import { createServerSupabase } from '@/lib/supabase-server'
import { getKoreaDateString, formatKoreaDateLong } from '@/lib/korea-date'
import StartSessionButton from './StartSessionButton'
import StudentLogout from '@/components/student/StudentLogout'

async function getTodayData() {
  const db = createServerSupabase()
  const today = getKoreaDateString()

  const [scheduleRes, sessionsRes] = await Promise.all([
    db
      .from('daily_schedules')
      .select('*, question:questions(*, subject:subjects(*))')
      .eq('schedule_date', today)
      .order('sort_order'),
    db
      .from('study_sessions')
      .select('*')
      .eq('session_date', today)
      .order('started_at', { ascending: false }),
  ])

  const rawSchedule = scheduleRes.data || []
  const schedule = rawSchedule.filter((row) => row.question?.is_approved)

  return {
    schedule,
    sessions: sessionsRes.data || [],
    today,
  }
}

export default async function TodayPage() {
  const { schedule, sessions, today } = await getTodayData()

  const todayStr = formatKoreaDateLong()

  const completedSession = sessions.find((s) => s.is_completed)
  const incompleteSession = sessions.find((s) => !s.is_completed)

  // Group by subject
  const bySubject = schedule.reduce<Record<string, typeof schedule>>((acc, s) => {
    const subjectName = s.question?.subject?.name_ko || '기타'
    if (!acc[subjectName]) acc[subjectName] = []
    acc[subjectName].push(s)
    return acc
  }, {})

  return (
    <div className="min-h-screen flex flex-col items-center justify-start px-4 py-8 max-w-lg mx-auto">
      {/* Header */}
      <div className="w-full flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">오늘의 학습 📚</h1>
          <p className="text-slate-400 text-sm mt-1">{todayStr}</p>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/student/history" className="text-slate-400 hover:text-white text-sm">
            학습 기록 →
          </Link>
          <StudentLogout />
        </div>
      </div>

      {/* Completed today */}
      {completedSession && (
        <div className="w-full bg-green-500/20 border border-green-500/40 rounded-2xl p-5 mb-6">
          <div className="flex items-center gap-3">
            <div className="text-4xl">🎉</div>
            <div>
              <p className="text-green-300 font-semibold">오늘 학습 완료!</p>
              <p className="text-green-400 text-sm">점수: {completedSession.score_pct}% ({completedSession.correct_count}/{completedSession.total_questions}개 정답)</p>
            </div>
          </div>
          <Link
            href={`/student/results/${completedSession.id}`}
            className="block mt-3 text-center text-sm text-green-300 hover:text-green-200"
          >
            결과 다시 보기 →
          </Link>
        </div>
      )}

      {/* No questions today */}
      {schedule.length === 0 ? (
        <div className="w-full text-center py-16">
          <div className="text-6xl mb-4">📭</div>
          <p className="text-slate-300 text-lg font-medium">오늘 배정된 문제가 없어요</p>
          <p className="text-slate-500 text-sm mt-2">아빠한테 문제 배정을 부탁해보세요!</p>
        </div>
      ) : (
        <>
          {/* Question overview by subject */}
          <div className="w-full space-y-3 mb-8">
            {Object.entries(bySubject).map(([subjectName, items]) => {
              const color = items[0]?.question?.subject?.color_hex || '#6366f1'
              return (
                <div key={subjectName} className="bg-slate-800 rounded-xl p-4 flex items-center gap-4">
                  <div
                    className="w-3 h-10 rounded-full shrink-0"
                    style={{ backgroundColor: color }}
                  />
                  <div>
                    <p className="text-white font-semibold">{subjectName}</p>
                    <p className="text-slate-400 text-sm">{items.length}문제</p>
                  </div>
                </div>
              )
            })}
          </div>

          <div className="w-full text-center text-slate-400 text-sm mb-6">
            총 {schedule.length}문제
          </div>

          {/* Start/Resume button */}
          <StartSessionButton
            schedule={schedule}
            today={today}
            incompleteSessionId={incompleteSession?.id}
            alreadyCompleted={!!completedSession}
          />
        </>
      )}
    </div>
  )
}
