'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Question, Difficulty } from '@/types'
import { SUBJECTS, DIFFICULTY_LABELS } from '@/lib/constants'

type Props = {
  question?: Question
}

export default function QuestionForm({ question }: Props) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    subject_id: question?.subject_id || SUBJECTS[0].id,
    difficulty: question?.difficulty || 2,
    question_text: question?.question_text || '',
    option_1: question?.option_1 || '',
    option_2: question?.option_2 || '',
    option_3: question?.option_3 || '',
    option_4: question?.option_4 || '',
    correct_answer: question?.correct_answer || 1,
    explanation: question?.explanation || '',
    source_year: question?.source_year || '',
    source_type: question?.source_type || 'manual',
    is_approved: question?.is_approved ?? true,
  })

  function update(field: string, value: unknown) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.question_text.trim() || !form.option_1 || !form.option_2 || !form.option_3 || !form.option_4) {
      setError('모든 필드를 입력해주세요')
      return
    }
    setSaving(true)
    setError('')

    const body = {
      ...form,
      subject_id: Number(form.subject_id),
      difficulty: Number(form.difficulty) as Difficulty,
      correct_answer: Number(form.correct_answer),
      source_year: form.source_year ? Number(form.source_year) : null,
    }

    const url = question ? `/api/questions/${question.id}` : '/api/questions'
    const method = question ? 'PUT' : 'POST'

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    if (res.ok) {
      router.push('/admin/questions')
      router.refresh()
    } else {
      const data = await res.json()
      setError(data.error || '저장에 실패했습니다')
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
      {/* Subject & Difficulty */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm text-slate-400 mb-2">과목</label>
          <select
            value={form.subject_id}
            onChange={(e) => update('subject_id', e.target.value)}
            className="w-full bg-slate-700 border border-slate-600 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-indigo-500"
          >
            {SUBJECTS.map((s) => (
              <option key={s.id} value={s.id}>{s.nameKo}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm text-slate-400 mb-2">난이도</label>
          <div className="flex gap-2">
            {[1, 2, 3].map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => update('difficulty', d)}
                className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  form.difficulty === d ? 'bg-indigo-600 text-white' : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
                }`}
              >
                {DIFFICULTY_LABELS[d]}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Question text */}
      <div>
        <label className="block text-sm text-slate-400 mb-2">문제</label>
        <textarea
          value={form.question_text}
          onChange={(e) => update('question_text', e.target.value)}
          rows={4}
          placeholder="문제를 입력하세요"
          className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 resize-none"
        />
      </div>

      {/* Options */}
      <div>
        <label className="block text-sm text-slate-400 mb-2">선택지 (정답을 선택하세요)</label>
        <div className="space-y-2">
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className="flex gap-3 items-center">
              <button
                type="button"
                onClick={() => update('correct_answer', n)}
                className={`w-8 h-8 rounded-full flex-shrink-0 font-bold text-sm transition-colors ${
                  form.correct_answer === n
                    ? 'bg-green-500 text-white'
                    : 'bg-slate-600 text-slate-400 hover:bg-slate-500'
                }`}
              >
                {n}
              </button>
              <input
                value={form[`option_${n}` as keyof typeof form] as string}
                onChange={(e) => update(`option_${n}`, e.target.value)}
                placeholder={`${n}번 선택지`}
                className={`flex-1 bg-slate-700 border rounded-xl px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none text-sm ${
                  form.correct_answer === n ? 'border-green-500' : 'border-slate-600 focus:border-indigo-500'
                }`}
              />
            </div>
          ))}
        </div>
        <p className="text-xs text-slate-500 mt-2">번호 버튼을 클릭하면 정답으로 설정됩니다</p>
      </div>

      {/* Explanation */}
      <div>
        <label className="block text-sm text-slate-400 mb-2">해설 (선택)</label>
        <textarea
          value={form.explanation}
          onChange={(e) => update('explanation', e.target.value)}
          rows={3}
          placeholder="정답 해설을 입력하세요"
          className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 resize-none"
        />
      </div>

      {/* Metadata */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm text-slate-400 mb-2">출제 연도 (선택)</label>
          <input
            type="number"
            value={form.source_year}
            onChange={(e) => update('source_year', e.target.value)}
            placeholder="예: 2023"
            className="w-full bg-slate-700 border border-slate-600 rounded-xl px-3 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          />
        </div>
        <div>
          <label className="block text-sm text-slate-400 mb-2">승인 여부</label>
          <button
            type="button"
            onClick={() => update('is_approved', !form.is_approved)}
            className={`w-full py-2.5 rounded-xl text-sm font-medium transition-colors ${
              form.is_approved ? 'bg-green-600 text-white' : 'bg-slate-700 text-slate-400'
            }`}
          >
            {form.is_approved ? '✅ 승인됨' : '⏳ 미승인'}
          </button>
        </div>
      </div>

      {error && <p className="text-red-400 text-sm">{error}</p>}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={saving}
          className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 text-white px-6 py-3 rounded-xl font-semibold transition-colors"
        >
          {saving ? '저장 중...' : '저장하기'}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="bg-slate-700 hover:bg-slate-600 text-slate-300 px-6 py-3 rounded-xl font-semibold transition-colors"
        >
          취소
        </button>
      </div>
    </form>
  )
}
