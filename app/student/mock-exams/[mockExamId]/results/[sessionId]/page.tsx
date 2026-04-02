'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { MockExamAttemptHistory } from '@/types'

interface ResultsData {
  session_id: string
  total_score: number
  max_score: number
  average_percentage: number
  subject_results: {
    subject: { id: number; name_ko: string; color_hex: string }
    total_questions: number
    correct_count: number
    score_percentage: number
  }[]
}

export default function ResultsPage() {
  const router = useRouter()
  const { mockExamId, sessionId } = useParams() as {
    mockExamId: string
    sessionId: string
  }

  const [results, setResults] = useState<ResultsData | null>(null)
  const [history, setHistory] = useState<MockExamAttemptHistory[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadResults() {
      try {
        // 결과 데이터 로드
        const resultsResponse = await fetch(
          `/api/mock-exams/${mockExamId}/${sessionId}/results`
        )
        if (!resultsResponse.ok) throw new Error('Failed to load results')
        const resultsData = await resultsResponse.json()
        setResults(resultsData)

        // 시도 기록 로드
        const historyResponse = await fetch(`/api/mock-exams/${mockExamId}/history`)
        if (historyResponse.ok) {
          const historyData = await historyResponse.json()
          setHistory(historyData)
        }
      } catch (error) {
        console.error('Error loading results:', error)
      } finally {
        setLoading(false)
      }
    }

    loadResults()
  }, [mockExamId, sessionId])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <p className="text-slate-400 text-lg">결과를 불러오는 중...</p>
      </div>
    )
  }

  if (!results) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <p className="text-red-400 text-lg">결과를 불러올 수 없습니다</p>
      </div>
    )
  }

  const maxSubjectScore = Math.max(
    ...results.subject_results.map((r) => r.score_percentage || 0),
    100
  )

  return (
    <div className="min-h-screen bg-slate-900 pb-10">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-4 py-8">
        <h1 className="text-3xl font-bold text-white mb-2">🎉 시험 완료!</h1>
        <p className="text-indigo-100">모의고사 결과를 확인하세요</p>
      </div>

      {/* Total Score */}
      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="bg-gradient-to-br from-slate-800 to-slate-700 rounded-2xl p-8 border border-indigo-500/30 mb-6">
          <div className="text-center">
            <p className="text-slate-400 text-lg mb-2">총점</p>
            <div className="text-6xl font-bold text-white mb-2">
              {results.total_score}/{results.max_score}
            </div>
            <div className="text-2xl font-semibold">
              <span
                className={`${
                  results.average_percentage >= 80
                    ? 'text-green-400'
                    : results.average_percentage >= 60
                      ? 'text-yellow-400'
                      : 'text-red-400'
                }`}
              >
                {results.average_percentage.toFixed(1)}%
              </span>
            </div>
          </div>
        </div>

        {/* 과목별 점수 테이블 */}
        <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden mb-6">
          <div className="bg-slate-700 px-6 py-4">
            <h2 className="text-xl font-bold text-white">📋 과목별 점수</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="px-6 py-3 text-left text-slate-400 font-semibold">과목</th>
                  <th className="px-6 py-3 text-center text-slate-400 font-semibold">정답</th>
                  <th className="px-6 py-3 text-center text-slate-400 font-semibold">점수</th>
                  <th className="px-6 py-3 text-center text-slate-400 font-semibold">백분율</th>
                </tr>
              </thead>
              <tbody>
                {results.subject_results.map((result, idx) => (
                  <tr key={idx} className="border-b border-slate-700 last:border-b-0">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: result.subject.color_hex }}
                        />
                        <span className="text-white font-medium">{result.subject.name_ko}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center text-white">
                      {result.correct_count}/{result.total_questions}
                    </td>
                    <td className="px-6 py-4 text-center text-white font-semibold">
                      {result.correct_count * 10}점
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span
                        className={`font-semibold ${
                          (result.score_percentage || 0) >= 80
                            ? 'text-green-400'
                            : (result.score_percentage || 0) >= 60
                              ? 'text-yellow-400'
                              : 'text-red-400'
                        }`}
                      >
                        {(result.score_percentage || 0).toFixed(0)}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* 과목별 그래프 */}
        <div className="bg-slate-800 rounded-2xl border border-slate-700 p-6 mb-6">
          <h2 className="text-xl font-bold text-white mb-6">📊 과목별 성적</h2>
          <div className="space-y-6">
            {results.subject_results.map((result, idx) => (
              <div key={idx}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: result.subject.color_hex }}
                    />
                    <span className="text-white font-medium">{result.subject.name_ko}</span>
                  </div>
                  <span className="text-white font-semibold">
                    {(result.score_percentage || 0).toFixed(0)}%
                  </span>
                </div>
                <div className="w-full h-8 bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className="h-full transition-all duration-500"
                    style={{
                      width: `${(result.score_percentage || 0)}%`,
                      backgroundColor: result.subject.color_hex,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 시도 기록 */}
        {history.length > 0 && (
          <div className="bg-slate-800 rounded-2xl border border-slate-700 p-6 mb-6">
            <h2 className="text-xl font-bold text-white mb-4">📈 시도 기록</h2>
            <div className="space-y-3">
              {history.slice(0, 5).map((attempt, idx) => (
                <div
                  key={attempt.id}
                  className="flex items-center justify-between p-3 bg-slate-700 rounded-lg"
                >
                  <div>
                    <p className="text-white font-medium">{idx + 1}차 시도</p>
                    <p className="text-slate-400 text-sm">
                      {new Date(attempt.attempt_date).toLocaleDateString('ko-KR')}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-white font-bold">{attempt.total_score}점</p>
                    <p className="text-slate-400 text-sm">
                      {attempt.average_percentage?.toFixed(1)}%
                    </p>
                  </div>
                </div>
              ))}
            </div>
            {history.length > 0 && (
              <div className="mt-4 pt-4 border-t border-slate-600">
                <p className="text-slate-400 text-sm">
                  평균: <span className="text-white font-semibold">{(
                    history.reduce((sum, a) => sum + (a.average_percentage || 0), 0) / history.length
                  ).toFixed(1)}%</span>
                </p>
              </div>
            )}
          </div>
        )}

        {/* 버튼 */}
        <div className="flex gap-3">
          <button
            onClick={() =>
              router.push(`/student/mock-exams/${mockExamId}/timer-selection`)
            }
            className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-4 rounded-xl transition-all active:scale-95"
          >
            🔄 다시 풀기
          </button>
          <button
            onClick={() => router.push('/student/mock-exams')}
            className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-semibold py-4 rounded-xl transition-all active:scale-95"
          >
            📚 모의고사 목록
          </button>
        </div>
      </div>
    </div>
  )
}
