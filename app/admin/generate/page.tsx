'use client'

import { useState } from 'react'
import { GeneratedQuestion, Difficulty } from '@/types'
import { SUBJECTS, DIFFICULTY_LABELS } from '@/lib/constants'

export default function GeneratePage() {
  const [subjectId, setSubjectId] = useState<number>(SUBJECTS[0].id)
  const [difficulty, setDifficulty] = useState<Difficulty>(2)
  const [count, setCount] = useState(5)
  const [generating, setGenerating] = useState(false)
  const [questions, setQuestions] = useState<GeneratedQuestion[]>([])
  const [approved, setApproved] = useState<Set<number>>(new Set())
  const [rejected, setRejected] = useState<Set<number>>(new Set())
  const [saving, setSaving] = useState(false)
  const [savedCount, setSavedCount] = useState(0)
  const [error, setError] = useState('')

  const selectedSubject = SUBJECTS.find((s) => s.id === subjectId)!

  async function handleGenerate() {
    setGenerating(true)
    setError('')
    setQuestions([])
    setApproved(new Set())
    setRejected(new Set())
    setSavedCount(0)

    const res = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subjectNameKo: selectedSubject.nameKo, difficulty, count }),
    })
    const data = await res.json()

    if (!res.ok) {
      setError(data.error || '생성에 실패했습니다')
    } else {
      const list = data.questions as GeneratedQuestion[]
      setQuestions(list)
      setApproved(new Set(list.map((_, i) => i)))
      setRejected(new Set())
    }
    setGenerating(false)
  }

  function toggleApprove(idx: number) {
    setApproved((prev) => {
      const next = new Set(prev)
      if (next.has(idx)) next.delete(idx)
      else { next.add(idx); setRejected((r) => { const rn = new Set(r); rn.delete(idx); return rn }) }
      return next
    })
  }

  function toggleReject(idx: number) {
    setRejected((prev) => {
      const next = new Set(prev)
      if (next.has(idx)) next.delete(idx)
      else { next.add(idx); setApproved((a) => { const an = new Set(a); an.delete(idx); return an }) }
      return next
    })
  }

  function approveAll() {
    setApproved(new Set(questions.map((_, i) => i)))
    setRejected(new Set())
  }

  async function handleSave() {
    const toSave = questions.filter((_, i) => approved.has(i))
    if (toSave.length === 0) {
      setError('승인한 문제가 없습니다')
      return
    }
    setSaving(true)
    let saved = 0
    for (const q of toSave) {
      const res = await fetch('/api/questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject_id: subjectId,
          difficulty,
          source_type: 'ai',
          is_approved: true,
          ...q,
        }),
      })
      if (res.ok) saved++
    }
    setSavedCount(saved)
    setSaving(false)
    setQuestions([])
    setApproved(new Set())
    setRejected(new Set())
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">AI 문제 생성</h1>
        <p className="text-slate-400 mt-1">ChatGPT가 검정고시 스타일 문제를 자동으로 생성합니다</p>
      </div>

      {savedCount > 0 && (
        <div className="bg-green-500/20 border border-green-500/40 rounded-xl p-4 text-green-300">
          ✅ {savedCount}개 문제가 저장되었습니다!
        </div>
      )}

      {/* Controls */}
      <div className="bg-slate-800 rounded-xl p-6 space-y-5">
        <div>
          <label className="block text-sm text-slate-400 mb-3">과목 선택</label>
          <div className="flex flex-wrap gap-2">
            {SUBJECTS.map((s) => (
              <button
                key={s.id}
                onClick={() => setSubjectId(s.id)}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                  subjectId === s.id ? 'text-white scale-105' : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
                }`}
                style={subjectId === s.id ? { backgroundColor: s.color } : {}}
              >
                {s.nameKo}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-slate-400 mb-3">난이도</label>
            <div className="flex gap-2">
              {[1, 2, 3].map((d) => (
                <button
                  key={d}
                  onClick={() => setDifficulty(d as Difficulty)}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                    difficulty === d ? 'bg-indigo-600 text-white' : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
                  }`}
                >
                  {DIFFICULTY_LABELS[d]}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-3">문제 수: <span className="text-white font-bold">{count}개</span></label>
            <input
              type="range"
              min={1}
              max={15}
              value={count}
              onChange={(e) => setCount(Number(e.target.value))}
              className="w-full"
            />
          </div>
        </div>

        {error && <p className="text-red-400 text-sm">{error}</p>}

        <button
          onClick={handleGenerate}
          disabled={generating}
          className="w-full bg-purple-600 hover:bg-purple-500 disabled:bg-slate-700 disabled:text-slate-500 text-white font-bold py-4 rounded-xl text-lg transition-all active:scale-95"
        >
          {generating ? '🤖 AI가 문제를 생성 중...' : `🤖 ${selectedSubject.nameKo} 문제 ${count}개 생성하기`}
        </button>
      </div>

      {/* Generated Questions Review */}
      {questions.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">생성된 문제 검토 ({questions.length}개)</h2>
            <div className="flex gap-3">
              <button
                onClick={approveAll}
                className="bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded-lg text-sm font-medium"
              >
                전체 승인
              </button>
              <button
                onClick={handleSave}
                disabled={saving || approved.size === 0}
                className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 disabled:text-slate-500 text-white px-4 py-2 rounded-lg text-sm font-medium"
              >
                {saving ? '저장 중...' : `✅ 승인된 ${approved.size}개 저장`}
              </button>
            </div>
          </div>

          {questions.map((q, i) => (
            <div
              key={i}
              className={`bg-slate-800 rounded-xl p-5 border-2 transition-colors ${
                approved.has(i) ? 'border-green-500' :
                rejected.has(i) ? 'border-red-500 opacity-60' :
                'border-slate-700'
              }`}
            >
              <p className="text-white font-medium mb-3">{i + 1}. {q.question_text}</p>
              <div className="grid grid-cols-2 gap-2 mb-3">
                {[1, 2, 3, 4].map((n) => (
                  <div
                    key={n}
                    className={`text-sm px-3 py-2 rounded-lg ${
                      q.correct_answer === n
                        ? 'bg-green-500/20 text-green-300 font-semibold'
                        : 'bg-slate-700 text-slate-300'
                    }`}
                  >
                    {n}. {q[`option_${n}` as keyof GeneratedQuestion] as string}
                  </div>
                ))}
              </div>
              {q.explanation && (
                <div className="bg-slate-700/50 rounded-lg p-3 text-xs text-slate-400 mb-3">
                  💡 {q.explanation}
                </div>
              )}
              <div className="flex gap-2">
                <button
                  onClick={() => toggleApprove(i)}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                    approved.has(i) ? 'bg-green-500 text-white' : 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                  }`}
                >
                  ✅ {approved.has(i) ? '승인됨' : '승인'}
                </button>
                <button
                  onClick={() => toggleReject(i)}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                    rejected.has(i) ? 'bg-red-500 text-white' : 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                  }`}
                >
                  ❌ {rejected.has(i) ? '거절됨' : '거절'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
