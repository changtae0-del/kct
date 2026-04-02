export const dynamic = 'force-dynamic'
import Link from 'next/link'
import { createServerSupabase } from '@/lib/supabase-server'
import { notFound } from 'next/navigation'

export default async function ResultsPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params
  const db = createServerSupabase()

  const [sessionRes, answersRes] = await Promise.all([
    db.from('study_sessions').select('*').eq('id', sessionId).single(),
    db
      .from('user_answers')
      .select('*, question:questions(*, subject:subjects(*))')
      .eq('session_id', sessionId)
      .order('answered_at'),
  ])

  if (sessionRes.error || !sessionRes.data) notFound()

  const session = sessionRes.data
  const answers = answersRes.data || []

  const scorePct = session.score_pct || 0
  const emoji = scorePct >= 90 ? '🏆' : scorePct >= 70 ? '⭐' : scorePct >= 50 ? '📚' : '💪'
  const message = scorePct >= 90 ? '완벽해요!' : scorePct >= 70 ? '잘했어요!' : scorePct >= 50 ? '조금만 더!' : '다시 도전!'

  // Group by subject
  const bySubject: Record<string, { total: number; correct: number; color: string }> = {}
  answers.forEach((a) => {
    const name = a.question?.subject?.name_ko || '기타'
    const color = a.question?.subject?.color_hex || '#6366f1'
    if (!bySubject[name]) bySubject[name] = { total: 0, correct: 0, color }
    bySubject[name].total++
    if (a.is_correct) bySubject[name].correct++
  })

  return (
    <div className="min-h-screen flex flex-col items-center px-4 py-8 max-w-lg mx-auto">
      {/* Score */}
      <div className="text-center mb-8">
        <div className="text-7xl mb-4">{emoji}</div>
        <div className="text-6xl font-bold text-white mb-2">{scorePct}%</div>
        <div className="text-2xl text-slate-300 font-medium">{message}</div>
        <div className="text-slate-400 mt-2">
          {session.correct_count}개 정답 / {session.total_questions}문제
        </div>
      </div>

      {/* Subject breakdown */}
      <div className="w-full bg-slate-800 rounded-2xl p-5 mb-6">
        <h2 className="font-semibold text-white mb-4">과목별 결과</h2>
        <div className="space-y-3">
          {Object.entries(bySubject).map(([name, stat]) => {
            const pct = Math.round((stat.correct / stat.total) * 100)
            return (
              <div key={name}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-slate-300 font-medium">{name}</span>
                  <span className="text-white font-semibold">{stat.correct}/{stat.total} ({pct}%)</span>
                </div>
                <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${pct}%`, backgroundColor: stat.color }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Wrong answers review */}
      {answers.filter((a) => !a.is_correct).length > 0 && (
        <div className="w-full bg-slate-800 rounded-2xl p-5 mb-6">
          <h2 className="font-semibold text-white mb-4">틀린 문제 복습</h2>
          <div className="space-y-4">
            {answers.filter((a) => !a.is_correct).map((a) => {
              const q = a.question
              if (!q) return null
              const options = [q.option_1, q.option_2, q.option_3, q.option_4]
              return (
                <div key={a.id} className="border border-slate-700 rounded-xl p-4">
                  <span
                    className="text-xs font-semibold px-2 py-0.5 rounded-full text-white mb-2 inline-block"
                    style={{ backgroundColor: q.subject?.color_hex || '#6366f1' }}
                  >
                    {q.subject?.name_ko}
                  </span>
                  <p className="text-white text-sm mb-3">{q.question_text}</p>
                  <div className="space-y-1">
                    {options.map((opt, i) => {
                      const n = i + 1
                      return (
                        <div
                          key={n}
                          className={`text-xs px-3 py-1.5 rounded-lg ${
                            q.correct_answer === n
                              ? 'bg-green-500/20 text-green-300 font-semibold'
                              : a.selected_answer === n
                              ? 'bg-red-500/20 text-red-300 line-through'
                              : 'text-slate-400'
                          }`}
                        >
                          {n}. {opt}
                        </div>
                      )
                    })}
                  </div>
                  {q.explanation && (
                    <p className="text-slate-400 text-xs mt-3 leading-relaxed">💡 {q.explanation}</p>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div className="w-full space-y-3">
        <Link
          href="/student/today"
          className="block w-full text-center bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-4 rounded-2xl text-lg transition-all active:scale-95"
        >
          오늘 화면으로 돌아가기
        </Link>
        <Link
          href="/student/history"
          className="block w-full text-center bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold py-4 rounded-2xl transition-all"
        >
          학습 기록 보기
        </Link>
      </div>
    </div>
  )
}
