'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { MockExamSet, Subject } from '@/types'

interface MockExamDetail extends MockExamSet {
  subjects: (Subject & { questions: { id: string }[] })[]
}

const DEFAULT_TIME_MINUTES = 20

export default function TimerSelectionPage() {
  const router = useRouter()
  const { mockExamId } = useParams() as { mockExamId: string }
  const [exam, setExam] = useState<MockExamDetail | null>(null)
  const [timeLimits, setTimeLimits] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [starting, setStarting] = useState(false)

  useEffect(() => {
    async function loadExamDetail() {
      try {
        const response = await fetch(`/api/mock-exams/details/${mockExamId}`)
        if (!response.ok) throw new Error('Failed to load exam')
        const data: MockExamDetail = await response.json()
        setExam(data)

        // 기본 시간 제한 설정
        const limits: Record<string, number> = {}
        data.subjects.forEach((subject) => {
          limits[subject.id] = DEFAULT_TIME_MINUTES * 60 // 초 단위
        })
        setTimeLimits(limits)
      } catch (error) {
        console.error('Error loading exam:', error)
      } finally {
        setLoading(false)
      }
    }

    loadExamDetail()
  }, [mockExamId])

  const handleTimeChange = (subjectId: string | number, minutes: string) => {
    const value = Math.max(0, parseInt(minutes) || 0)
    setTimeLimits((prev) => ({
      ...prev,
      [subjectId]: value * 60, // 초 단위로 저장
    }))
  }

  const handleStartExam = async () => {
    if (!exam) return

    setStarting(true)
    try {
      // 세션 생성
      const sessionResponse = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_date: new Date().toISOString().split('T')[0],
          mock_exam_set_id: mockExamId,
          total_questions: exam.total_questions,
        }),
      })

      if (!sessionResponse.ok) {
        throw new Error('Failed to create session')
      }

      const session = await sessionResponse.json()

      // 타임 제한 정보를 sessionStorage에 저장
      sessionStorage.setItem(`exam_timers_${session.id}`, JSON.stringify(timeLimits))
      sessionStorage.setItem(`exam_subjects_${session.id}`, JSON.stringify(exam.subjects))

      // 시험 풀이 페이지로 이동
      router.push(`/student/mock-exams/${mockExamId}/exam/${session.id}`)
    } catch (error) {
      console.error('Error starting exam:', error)
      alert('시험을 시작할 수 없습니다')
    } finally {
      setStarting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <p className="text-slate-400 text-lg">로드 중...</p>
      </div>
    )
  }

  if (!exam) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <p className="text-red-400 text-lg">모의고사를 불러올 수 없습니다</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-emerald-950 pb-10">
      {/* Header */}
      <div className="bg-emerald-900 border-b border-emerald-800 px-4 py-6">
        <button
          onClick={() => router.back()}
          className="text-emerald-400 hover:text-emerald-300 mb-4 font-medium"
        >
          ← 돌아가기
        </button>
        <h1 className="text-2xl font-bold text-white">{exam.title}</h1>
        <p className="text-slate-400 text-sm mt-2">과목별 시간을 설정하고 시험을 시작하세요</p>
      </div>

      {/* Content */}
      <div className="max-w-2xl mx-auto px-4 py-6">
        <div className="bg-emerald-900 rounded-2xl p-6 space-y-6 border border-emerald-800">
          <div>
            <h2 className="text-lg font-bold text-white mb-4">⏱️ 과목별 시간 설정</h2>
            <div className="space-y-4">
              {exam.subjects.map((subject) => (
                <div
                  key={subject.id}
                  className="flex items-center justify-between p-4 bg-emerald-800 rounded-xl"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-4 h-4 rounded-full"
                      style={{ backgroundColor: subject.color_hex }}
                    />
                    <div>
                      <p className="text-white font-medium">{subject.name_ko}</p>
                      <p className="text-emerald-300 text-sm">
                        {subject.questions.length}문제
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="0"
                      value={Math.floor((timeLimits[subject.id] || 0) / 60)}
                      onChange={(e) => handleTimeChange(subject.id, e.target.value)}
                      className="w-16 px-2 py-2 bg-emerald-700 text-white rounded-lg text-center focus:outline-none focus:border-emerald-400"
                    />
                    <span className="text-slate-400 font-medium">분</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-emerald-900/30 border border-emerald-500/30 rounded-xl p-4">
            <p className="text-emerald-300 text-sm">
              💡 각 과목마다 정한 시간이 끝나면 자동으로 채점되고 다음 과목으로 넘어갑니다
            </p>
          </div>

          <button
            onClick={handleStartExam}
            disabled={starting}
            className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-800 disabled:text-emerald-400 text-white font-bold py-4 rounded-xl transition-all active:scale-95 text-lg"
          >
            {starting ? '시험 준비 중...' : '🎯 시험 시작'}
          </button>
        </div>
      </div>
    </div>
  )
}
