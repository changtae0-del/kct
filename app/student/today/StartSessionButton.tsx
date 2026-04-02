'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { DailySchedule } from '@/types'

type Props = {
  schedule: DailySchedule[]
  today: string
  incompleteSessionId?: string
  alreadyCompleted: boolean
}

export default function StartSessionButton({ schedule, today, incompleteSessionId, alreadyCompleted }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handleStart() {
    setLoading(true)

    if (incompleteSessionId) {
      router.push(`/student/study/${incompleteSessionId}`)
      return
    }

    const res = await fetch('/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_date: today, total_questions: schedule.length }),
    })
    const session = await res.json()
    router.push(`/student/study/${session.id}`)
  }

  if (alreadyCompleted && !incompleteSessionId) {
    return (
      <button
        onClick={handleStart}
        disabled={loading}
        className="w-full bg-slate-700 hover:bg-slate-600 text-slate-300 font-bold py-5 rounded-2xl text-lg transition-all active:scale-95"
      >
        다시 풀기
      </button>
    )
  }

  return (
    <button
      onClick={handleStart}
      disabled={loading}
      className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 text-white font-bold py-5 rounded-2xl text-xl transition-all active:scale-95 shadow-lg shadow-indigo-500/30"
    >
      {loading ? '준비 중...' : incompleteSessionId ? '이어서 풀기 →' : '공부 시작! →'}
    </button>
  )
}
