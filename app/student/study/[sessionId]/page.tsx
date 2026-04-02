'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { DailySchedule, CorrectAnswer } from '@/types'

type QuestionState = 'answering' | 'feedback'

export default function StudyPage() {
  const { sessionId } = useParams() as { sessionId: string }
  const router = useRouter()

  const [questions, setQuestions] = useState<DailySchedule[]>([])
  const [answeredIds, setAnsweredIds] = useState<Set<string>>(new Set())
  const [currentIndex, setCurrentIndex] = useState(0)
  const [state, setState] = useState<QuestionState>('answering')
  const [selectedAnswer, setSelectedAnswer] = useState<CorrectAnswer | null>(null)
  const [isCorrect, setIsCorrect] = useState(false)
  const [loading, setLoading] = useState(true)
  const [currentRoundWrong, setCurrentRoundWrong] = useState<Set<string>>(new Set())
  const [isRetryRound, setIsRetryRound] = useState(false)

  const questionStartTime = useRef<number>(Date.now())

  useEffect(() => {
    async function load() {
      // Get session to know today's date
      const sessionRes = await fetch(`/api/sessions/${sessionId}`)
      const sessionData = await sessionRes.json()
      const sessionDate = sessionData.session?.session_date

      // Get scheduled questions for the session date
      const schedRes = await fetch(`/api/schedule/${sessionDate}`)
      const schedData: DailySchedule[] = await schedRes.json()
      setQuestions(schedData)

      // Mark already answered
      const answered = new Set<string>(
        sessionData.answers.map((a: { question_id: string }) => a.question_id)
      )
      setAnsweredIds(answered)

      // Start from first unanswered
      const firstUnanswered = schedData.findIndex((s) => !answered.has(s.question_id))
      setCurrentIndex(firstUnanswered >= 0 ? firstUnanswered : 0)

      setLoading(false)
      questionStartTime.current = Date.now()
    }
    load()
  }, [sessionId])

  const current = questions[currentIndex]
  const question = current?.question

  async function handleAnswer(answer: CorrectAnswer) {
    if (state !== 'answering' || !question) return

    const timeTaken = Date.now() - questionStartTime.current
    const correct = answer === question.correct_answer

    setSelectedAnswer(answer)
    setIsCorrect(correct)
    setState('feedback')

    await fetch('/api/answers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: sessionId,
        question_id: question.id,
        selected_answer: answer,
        is_correct: correct,
        time_taken_ms: timeTaken,
      }),
    })

    setAnsweredIds((prev) => new Set([...prev, question.id]))

    // 틀린 문제를 현재 라운드 오답 세트에 추가
    if (!correct) {
      setCurrentRoundWrong((prev) => new Set([...prev, question.id]))
    }
  }

  async function handleNext() {
    const nextIndex = currentIndex + 1
    if (nextIndex >= questions.length) {
      // 현재 라운드에서 틀린 문제가 있는지 확인
      if (currentRoundWrong.size > 0) {
        // 틀린 문제들만 필터링해서 다시 출현
        const retryQuestions = questions.filter((q) =>
          currentRoundWrong.has(q.question_id)
        )

        setQuestions(retryQuestions)
        setCurrentIndex(0)
        setAnsweredIds(new Set()) // 재풀이를 위해 초기화
        setCurrentRoundWrong(new Set()) // 다음 라운드를 위해 초기화
        setIsRetryRound(true) // 재풀이 라운드 표시
        setState('answering')
        questionStartTime.current = Date.now()
      } else {
        // 모든 문제를 맞음 → 세션 완료
        await fetch(`/api/sessions/${sessionId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ is_completed: true }),
        })
        router.push(`/student/results/${sessionId}`)
      }
    } else {
      setCurrentIndex(nextIndex)
      setSelectedAnswer(null)
      setState('answering')
      questionStartTime.current = Date.now()
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-slate-400 text-lg">불러오는 중...</p>
      </div>
    )
  }

  if (!question) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-slate-400">문제를 불러올 수 없습니다</p>
      </div>
    )
  }

  const subject = question.subject
  const progress = ((currentIndex) / questions.length) * 100
  const options = [question.option_1, question.option_2, question.option_3, question.option_4] as const

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#0f172a' }}>
      {/* Header */}
      <div className="px-4 pt-safe-top pt-6 pb-4">
        <div className="flex items-center justify-between mb-3">
          <span
            className="text-sm font-bold px-3 py-1 rounded-full text-white"
            style={{ backgroundColor: subject?.color_hex || '#6366f1' }}
          >
            {subject?.name_ko || '문제'}
          </span>
          <div className="flex items-center gap-2">
            <span className="text-slate-400 text-sm font-medium">
              {currentIndex + 1} / {questions.length}
            </span>
            {isRetryRound && (
              <span className="text-xs px-2 py-1 rounded bg-amber-500/20 text-amber-300 font-medium">
                [오답문제를 다시 풀어봅시다]
              </span>
            )}
          </div>
        </div>
        {/* Progress bar */}
        <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${progress}%`, backgroundColor: subject?.color_hex || '#6366f1' }}
          />
        </div>
      </div>

      {/* Question */}
      <div className="flex-1 px-4 py-6 flex flex-col">
        <div className="bg-slate-800 rounded-2xl p-6 mb-6">
          <p className="text-white text-2xl leading-relaxed font-medium">{question.question_text}</p>
        </div>

        {/* Answer Options */}
        <div className="space-y-3 flex-1">
          {options.map((opt, i) => {
            const n = (i + 1) as CorrectAnswer
            let btnClass = 'bg-slate-800 border-slate-700 text-white hover:bg-slate-700 active:scale-95'

            if (state === 'feedback') {
              if (n === question.correct_answer) {
                btnClass = 'bg-green-500 border-green-400 text-white'
              } else if (n === selectedAnswer) {
                btnClass = 'bg-red-500 border-red-400 text-white'
              } else {
                btnClass = 'bg-slate-800 border-slate-700 text-slate-500'
              }
            } else if (selectedAnswer === n) {
              btnClass = 'bg-indigo-600 border-indigo-500 text-white'
            }

            return (
              <button
                key={n}
                onClick={() => handleAnswer(n)}
                disabled={state === 'feedback'}
                className={`w-full min-h-[72px] px-5 py-4 rounded-2xl border-2 text-left text-xl font-medium transition-all ${btnClass}`}
              >
                <span className="inline-flex items-center gap-3">
                  <span className="text-lg opacity-70">{n}.</span>
                  <span>{opt}</span>
                </span>
              </button>
            )
          })}
        </div>

        {/* Feedback */}
        {state === 'feedback' && (
          <div className={`mt-5 rounded-2xl p-5 ${isCorrect ? 'bg-green-500/20' : 'bg-red-500/20'}`}>
            <p className={`text-xl font-bold mb-2 ${isCorrect ? 'text-green-300' : 'text-red-300'}`}>
              {isCorrect ? '🎉 정답입니다!' : '❌ 틀렸습니다'}
            </p>
            {question.explanation && (
              <p className="text-slate-300 text-sm leading-relaxed">{question.explanation}</p>
            )}
            <button
              onClick={handleNext}
              className="mt-4 w-full bg-white/10 hover:bg-white/20 text-white font-semibold py-4 rounded-xl text-lg transition-all active:scale-95"
            >
              {currentIndex + 1 >= questions.length ? '결과 보기 →' : '다음 문제 →'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
