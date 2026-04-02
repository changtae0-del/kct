'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function RunDailyGenerationButton() {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  async function run() {
    if (!confirm('한국 날짜 기준 오늘 일정을 비우고, AI로 과목별 문제를 다시 만듭니다. 진행할까요?')) return
    setBusy(true)
    setMsg(null)
    try {
      const res = await fetch('/api/admin/run-daily-generation', {
        method: 'POST',
        credentials: 'include',
      })
      const data = await res.json()
      if (!res.ok) {
        const err = typeof data.error === 'string' ? data.error : JSON.stringify(data)
        setMsg(`실패: ${err}`)
        return
      }
      const errs = Array.isArray(data.errors) && data.errors.length ? ` / 오류: ${data.errors.join('; ')}` : ''
      setMsg(`완료 (${data.scheduleDate}): 과목 ${data.subjectsOk}/7, 문제 ${data.questionsCreated}개${errs}`)
      router.refresh()
    } catch (e) {
      setMsg(e instanceof Error ? e.message : '오류')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={run}
        disabled={busy}
        className="w-full flex items-center gap-3 p-3 rounded-lg bg-purple-700 hover:bg-purple-600 disabled:bg-slate-600 disabled:text-slate-400 transition-colors text-white text-left"
      >
        <span>⚡</span>
        <span className="text-sm font-medium flex-1">
          {busy ? '오늘 문제 생성 중… (1~3분 걸릴 수 있음)' : '오늘 문제 지금 자동 생성 (Cron과 동일)'}
        </span>
      </button>
      {msg && <p className="text-xs text-slate-400 whitespace-pre-wrap break-words">{msg}</p>}
    </div>
  )
}
