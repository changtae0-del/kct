'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import StudentLogout from '@/components/student/StudentLogout'
import { MockExamSet } from '@/types'

export default function MockExamsPage() {
  const router = useRouter()
  const [exams, setExams] = useState<MockExamSet[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadExams() {
      try {
        const response = await fetch('/api/mock-exams')
        if (!response.ok) throw new Error('Failed to load exams')
        const data = await response.json()
        setExams(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : '모의고사를 불러올 수 없습니다')
      } finally {
        setLoading(false)
      }
    }

    loadExams()
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <p className="text-slate-400 text-lg">모의고사 목록을 불러오는 중...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <p className="text-red-400 text-lg">{error}</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-900 pb-10">
      {/* Header */}
      <div className="bg-slate-800 border-b border-slate-700 px-4 py-4 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">📚 모의고사</h1>
            <p className="text-slate-400 text-sm mt-1">검정고시 기출문제로 실력을 확인하세요</p>
          </div>
          <StudentLogout />
        </div>

        {/* 탭 */}
        <div className="flex gap-4 mt-4 border-b border-slate-700">
          <Link href="/student/today">
            <span className="px-4 py-2 text-slate-400 hover:text-white border-b-2 border-transparent hover:border-indigo-500 transition-all">
              📝 오늘의 문제
            </span>
          </Link>
          <span className="px-4 py-2 text-white border-b-2 border-indigo-500">
            🎯 모의고사
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 py-6">
        {exams.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-slate-400 text-lg">아직 모의고사가 없습니다</p>
            <p className="text-slate-500 text-sm mt-2">관리자가 추가하면 여기에 나타납니다</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {exams.map((exam) => (
              <div
                key={exam.id}
                className="bg-slate-800 rounded-2xl p-6 border border-slate-700 hover:border-indigo-500 transition-all"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h2 className="text-xl font-bold text-white">{exam.title}</h2>
                    {exam.description && (
                      <p className="text-slate-400 text-sm mt-1">{exam.description}</p>
                    )}
                    <div className="flex gap-4 mt-3">
                      <span className="text-slate-400 text-sm">
                        📖 {exam.total_questions}문제
                      </span>
                      <span className="text-slate-400 text-sm">
                        📅 {exam.year}년
                        {exam.session_number && ` ${exam.session_number}회`}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => router.push(`/student/mock-exams/${exam.id}/timer-selection`)}
                    className="ml-4 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl transition-all active:scale-95 whitespace-nowrap"
                  >
                    시작
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
