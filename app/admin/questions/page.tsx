'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Question } from '@/types'
import { SUBJECTS, DIFFICULTY_LABELS, DIFFICULTY_COLORS } from '@/lib/constants'

export default function QuestionsPage() {
  const [questions, setQuestions] = useState<Question[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedSubject, setSelectedSubject] = useState<string>('all')
  const [approvedOnly, setApprovedOnly] = useState(false)

  async function fetchQuestions() {
    setLoading(true)
    const params = new URLSearchParams()
    if (selectedSubject !== 'all') params.set('subject_id', selectedSubject)
    if (approvedOnly) params.set('approved', 'true')
    const res = await fetch(`/api/questions?${params}`)
    const data = await res.json()
    setQuestions(Array.isArray(data) ? data : [])
    setLoading(false)
  }

  useEffect(() => { fetchQuestions() }, [selectedSubject, approvedOnly])

  async function handleDelete(id: string) {
    if (!confirm('이 문제를 삭제하시겠습니까?')) return
    await fetch(`/api/questions/${id}`, { method: 'DELETE' })
    fetchQuestions()
  }

  async function handleToggleApprove(q: Question) {
    await fetch(`/api/questions/${q.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_approved: !q.is_approved }),
    })
    fetchQuestions()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">문제 은행</h1>
        <Link
          href="/admin/questions/new"
          className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          + 새 문제 추가
        </Link>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <button
          onClick={() => setSelectedSubject('all')}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            selectedSubject === 'all' ? 'bg-indigo-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
          }`}
        >
          전체
        </button>
        {SUBJECTS.map((s) => (
          <button
            key={s.id}
            onClick={() => setSelectedSubject(String(s.id))}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              selectedSubject === String(s.id) ? 'text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            }`}
            style={selectedSubject === String(s.id) ? { backgroundColor: s.color } : {}}
          >
            {s.nameKo}
          </button>
        ))}
        <button
          onClick={() => setApprovedOnly(!approvedOnly)}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ml-auto ${
            approvedOnly ? 'bg-green-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
          }`}
        >
          ✅ 승인된 것만
        </button>
      </div>

      {/* Question List */}
      {loading ? (
        <div className="text-center py-12 text-slate-400">불러오는 중...</div>
      ) : questions.length === 0 ? (
        <div className="text-center py-12 text-slate-500">
          <div className="text-4xl mb-3">📭</div>
          <p>문제가 없습니다. 새 문제를 추가하거나 AI로 생성해보세요.</p>
          <div className="flex gap-3 justify-center mt-4">
            <Link href="/admin/questions/new" className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm">직접 입력</Link>
            <Link href="/admin/generate" className="bg-purple-600 text-white px-4 py-2 rounded-lg text-sm">🤖 AI 생성</Link>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {questions.map((q) => (
            <div key={q.id} className="bg-slate-800 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <span
                      className="text-xs font-semibold px-2 py-0.5 rounded-full text-white"
                      style={{ backgroundColor: q.subject?.color_hex || '#6366f1' }}
                    >
                      {q.subject?.name_ko}
                    </span>
                    <span
                      className="text-xs px-2 py-0.5 rounded-full text-white"
                      style={{ backgroundColor: DIFFICULTY_COLORS[q.difficulty] }}
                    >
                      {DIFFICULTY_LABELS[q.difficulty]}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      q.is_approved ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'
                    }`}>
                      {q.is_approved ? '✅ 승인됨' : '⏳ 미승인'}
                    </span>
                    <span className="text-xs text-slate-500">{q.source_type === 'ai' ? '🤖 AI' : q.source_type === 'official' ? '📋 공식' : '✏️ 직접'}</span>
                  </div>
                  <p className="text-white text-sm leading-relaxed">{q.question_text}</p>
                  <div className="grid grid-cols-2 gap-1 mt-2">
                    {[q.option_1, q.option_2, q.option_3, q.option_4].map((opt, i) => (
                      <span key={i} className={`text-xs px-2 py-1 rounded ${
                        q.correct_answer === i + 1 ? 'bg-green-500/20 text-green-300' : 'text-slate-400'
                      }`}>
                        {i + 1}. {opt}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="flex flex-col gap-2 shrink-0">
                  <button
                    onClick={() => handleToggleApprove(q)}
                    className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
                      q.is_approved
                        ? 'bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30'
                        : 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                    }`}
                  >
                    {q.is_approved ? '승인 취소' : '승인'}
                  </button>
                  <Link
                    href={`/admin/questions/${q.id}`}
                    className="text-xs px-3 py-1.5 rounded-lg bg-slate-700 text-slate-300 hover:bg-slate-600 text-center font-medium"
                  >
                    편집
                  </Link>
                  <button
                    onClick={() => handleDelete(q.id)}
                    className="text-xs px-3 py-1.5 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 font-medium"
                  >
                    삭제
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
