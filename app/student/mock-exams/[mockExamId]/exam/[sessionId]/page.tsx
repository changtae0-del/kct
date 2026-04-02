'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { MockExamSet, Subject, Question, CorrectAnswer } from '@/types'

interface ExamState {
  subjects: (Subject & { questions: Question[] })[]
  currentSubjectIndex: number
  currentQuestionIndex: number
  timeRemaining: number
  totalTime: number
  isTimeEnded: boolean
  subjectAnswers: Record<number, Record<string, CorrectAnswer>> // [subjectId][questionId]
}

const INITIAL_STATE: ExamState = {
  subjects: [],
  currentSubjectIndex: 0,
  currentQuestionIndex: 0,
  timeRemaining: 1200, // 20분
  totalTime: 1200,
  isTimeEnded: false,
  subjectAnswers: {},
}

export default function ExamPage() {
  const router = useRouter()
  const { mockExamId, sessionId } = useParams() as {
    mockExamId: string
    sessionId: string
  }

  const [state, setState] = useState<ExamState>(INITIAL_STATE)
  const [loading, setLoading] = useState(true)
  const [feedback, setFeedback] = useState<{
    show: boolean
    isCorrect: boolean
    score?: { correct: number; total: number }
  }>({ show: false, isCorrect: false })

  const timerRef = useRef<NodeJS.Timeout | undefined>(undefined)
  const timeLimitsRef = useRef<Record<string, number>>({})

  // 초기 로드
  useEffect(() => {
    async function loadExamData() {
      try {
        // 모의고사 상세 정보 로드
        const examResponse = await fetch(`/api/mock-exams/details/${mockExamId}`)
        if (!examResponse.ok) throw new Error('Failed to load exam')
        const examData: MockExamSet & {
          subjects: (Subject & { questions: Question[] })[]
        } = await examResponse.json()

        // sessionStorage에서 타이머 제한 정보 로드
        const timeLimits = JSON.parse(
          sessionStorage.getItem(`exam_timers_${sessionId}`) || '{}'
        ) as Record<string, number>
        timeLimitsRef.current = timeLimits

        // 초기 상태 설정
        const firstSubjectId = examData.subjects[0]?.id
        const firstTimeLimit = timeLimits[firstSubjectId] || 1200

        setState({
          subjects: examData.subjects,
          currentSubjectIndex: 0,
          currentQuestionIndex: 0,
          timeRemaining: firstTimeLimit,
          totalTime: firstTimeLimit,
          isTimeEnded: false,
          subjectAnswers: examData.subjects.reduce<Record<number, Record<string, CorrectAnswer>>>(
            (acc, subject) => {
              acc[subject.id] = {}
              return acc
            },
            {}
          ),
        })

        setLoading(false)
      } catch (error) {
        console.error('Error loading exam:', error)
      }
    }

    loadExamData()
  }, [mockExamId, sessionId])

  // 타이머 로직
  useEffect(() => {
    if (loading || state.subjects.length === 0 || feedback.show) return

    timerRef.current = setInterval(() => {
      setState((prevState) => {
        const newTimeRemaining = prevState.timeRemaining - 1

        if (newTimeRemaining <= 0) {
          // 시간 종료 - 자동으로 다음 과목으로
          handleNextSubject(true)
          return prevState
        }

        return {
          ...prevState,
          timeRemaining: newTimeRemaining,
        }
      })
    }, 1000)

    return () => clearInterval(timerRef.current)
  }, [loading, state.subjects.length, feedback.show])

  const currentSubject = state.subjects[state.currentSubjectIndex]
  const currentQuestion = currentSubject?.questions[state.currentQuestionIndex]
  const subjectAnswers = state.subjectAnswers[currentSubject?.id] || {}
  const currentAnswer = currentQuestion?.id ? subjectAnswers[currentQuestion.id] : undefined

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  const handleAnswer = useCallback(
    (answer: CorrectAnswer) => {
      if (!currentQuestion || feedback.show) return

      setState((prev) => ({
        ...prev,
        subjectAnswers: {
          ...prev.subjectAnswers,
          [currentSubject.id]: {
            ...prev.subjectAnswers[currentSubject.id],
            [currentQuestion.id]: answer,
          },
        },
      }))

      // 피드백 표시
      const isCorrect = answer === currentQuestion.correct_answer
      setFeedback({ show: true, isCorrect })
    },
    [currentQuestion, currentSubject, feedback.show]
  )

  const handleNextQuestion = useCallback(async () => {
    if (!currentQuestion) return

    setFeedback({ show: false, isCorrect: false })

    const nextQuestionIndex = state.currentQuestionIndex + 1

    if (nextQuestionIndex < currentSubject.questions.length) {
      // 같은 과목의 다음 문제
      setState((prev) => ({
        ...prev,
        currentQuestionIndex: nextQuestionIndex,
      }))
    } else {
      // 현재 과목 완료 - 다음 과목으로
      handleNextSubject(false)
    }
  }, [state.currentQuestionIndex, currentSubject, currentQuestion])

  const handleNextSubject = async (autoSubmit: boolean = false) => {
    // 현재 과목의 답변 저장
    const answers = state.subjectAnswers[currentSubject.id] || {}
    const correctCount = Object.entries(answers).filter(([qId]) => {
      const question = currentSubject.questions.find((q) => q.id === qId)
      return question && answers[qId] === question.correct_answer
    }).length

    // API에 과목별 결과 저장
    try {
      await fetch(`/api/mock-exams/${mockExamId}/subject-results`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          subject_id: currentSubject.id,
          total_questions: currentSubject.questions.length,
          correct_count: correctCount,
          time_limit_seconds: state.totalTime,
          time_used_seconds: state.totalTime - state.timeRemaining,
        }),
      })
    } catch (error) {
      console.error('Error saving subject result:', error)
    }

    const nextSubjectIndex = state.currentSubjectIndex + 1

    if (nextSubjectIndex < state.subjects.length) {
      // 다음 과목으로 이동
      const nextSubject = state.subjects[nextSubjectIndex]
      const nextTimeLimit = timeLimitsRef.current[nextSubject.id] || 1200

      setState({
        subjects: state.subjects,
        currentSubjectIndex: nextSubjectIndex,
        currentQuestionIndex: 0,
        timeRemaining: nextTimeLimit,
        totalTime: nextTimeLimit,
        isTimeEnded: false,
        subjectAnswers: state.subjectAnswers,
      })

      setFeedback({ show: false, isCorrect: false })
    } else {
      // 모든 과목 완료 - 결과 페이지로
      // 최종 결과 저장
      try {
        await fetch(`/api/mock-exams/${mockExamId}/${sessionId}/results`, {
          method: 'POST',
        })
      } catch (error) {
        console.error('Error saving final results:', error)
      }

      router.push(`/student/mock-exams/${mockExamId}/results/${sessionId}`)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <p className="text-slate-400 text-lg">시험을 준비하는 중...</p>
      </div>
    )
  }

  if (!currentSubject || !currentQuestion) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <p className="text-red-400 text-lg">문제를 불러올 수 없습니다</p>
      </div>
    )
  }

  const progress = ((state.currentQuestionIndex) / currentSubject.questions.length) * 100

  return (
    <div className="min-h-screen flex flex-col bg-emerald-950">
      {/* Header */}
      <div className="px-4 pt-safe-top pt-6 pb-4 bg-emerald-900 border-b border-emerald-800">
        <div className="flex items-center justify-between mb-3">
          <span
            className="text-sm font-bold px-3 py-1 rounded-full text-white"
            style={{ backgroundColor: currentSubject.color_hex }}
          >
            {currentSubject.name_ko}
          </span>
          <div className="flex items-center gap-4">
            <span className="text-slate-400 text-sm font-medium">
              {state.currentQuestionIndex + 1} / {currentSubject.questions.length}
            </span>
            <div
              className={`text-3xl font-bold font-mono ${
                state.timeRemaining < 300 ? 'text-red-400' : 'text-green-300'
              }`}
            >
              {formatTime(state.timeRemaining)}
            </div>
          </div>
        </div>

        {/* Progress bar */}
        <div className="h-2 bg-emerald-800 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${progress}%`, backgroundColor: currentSubject.color_hex }}
          />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 px-4 py-6 flex flex-col">
        <div className="bg-emerald-900 rounded-2xl p-6 mb-6 border border-emerald-800">
          <p className="text-white text-2xl leading-relaxed font-medium">
            {currentQuestion.question_text}
          </p>
        </div>

        {/* Options */}
        <div className="space-y-3 flex-1">
          {[
            currentQuestion.option_1,
            currentQuestion.option_2,
            currentQuestion.option_3,
            currentQuestion.option_4,
          ].map((option, i) => {
            const answerNum = (i + 1) as CorrectAnswer
            let btnClass = 'bg-emerald-800 border-emerald-700 text-white hover:bg-emerald-700 active:scale-95'

            if (feedback.show) {
              if (answerNum === currentQuestion.correct_answer) {
                btnClass = 'bg-green-500 border-green-400 text-white'
              } else if (answerNum === currentAnswer) {
                btnClass = 'bg-red-500 border-red-400 text-white'
              } else {
                btnClass = 'bg-emerald-800 border-emerald-700 text-emerald-300'
              }
            } else if (currentAnswer === answerNum) {
              btnClass = 'bg-emerald-600 border-emerald-500 text-white'
            }

            return (
              <button
                key={answerNum}
                onClick={() => handleAnswer(answerNum)}
                disabled={feedback.show}
                className={`w-full min-h-[72px] px-5 py-4 rounded-2xl border-2 text-left text-xl font-medium transition-all ${btnClass}`}
              >
                <span className="inline-flex items-center gap-3">
                  <span className="text-lg opacity-70">{answerNum}.</span>
                  <span>{option}</span>
                </span>
              </button>
            )
          })}
        </div>

        {/* Feedback */}
        {feedback.show && (
          <div className={`mt-5 rounded-2xl p-5 ${feedback.isCorrect ? 'bg-green-500/20' : 'bg-red-500/20'}`}>
            <p className={`text-xl font-bold mb-2 ${feedback.isCorrect ? 'text-green-300' : 'text-red-300'}`}>
              {feedback.isCorrect ? '🎉 정답입니다!' : '❌ 틀렸습니다'}
            </p>
            {currentQuestion.explanation && (
              <p className="text-emerald-100 text-sm leading-relaxed">{currentQuestion.explanation}</p>
            )}
            <button
              onClick={handleNextQuestion}
              className="mt-4 w-full bg-emerald-700/30 hover:bg-emerald-600/30 text-white font-semibold py-4 rounded-xl text-lg transition-all active:scale-95"
            >
              {state.currentQuestionIndex + 1 >= currentSubject.questions.length
                ? '다음 과목 →'
                : '다음 문제 →'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
