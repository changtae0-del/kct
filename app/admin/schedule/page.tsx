'use client'

import { useEffect, useState } from 'react'
import { DailySchedule, Question } from '@/types'
import { SUBJECTS } from '@/lib/constants'
import {
  getKoreaDateString,
  getKoreaCalendarParts,
  getDaysInGregorianMonth,
  getKoreaWeekdayForYmd,
} from '@/lib/korea-date'

export default function SchedulePage() {
  const [viewYear, setViewYear] = useState(() => getKoreaCalendarParts().year)
  const [viewMonth, setViewMonth] = useState(() => getKoreaCalendarParts().monthIndex0)
  const [selectedDate, setSelectedDate] = useState(() => getKoreaDateString())
  const [schedules, setSchedules] = useState<Record<string, DailySchedule[]>>({})
  const [availableQuestions, setAvailableQuestions] = useState<Question[]>([])
  const [loading, setLoading] = useState(true)

  const lastDay = getDaysInGregorianMonth(viewYear, viewMonth)
  const monthCells = Array.from({ length: lastDay }, (_, i) => {
    const dayNum = i + 1
    const mm = String(viewMonth + 1).padStart(2, '0')
    const dd = String(dayNum).padStart(2, '0')
    return { ymd: `${viewYear}-${mm}-${dd}`, dayNum }
  })
  const firstOfMonthYmd = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-01`
  const firstDayOfWeek = getKoreaWeekdayForYmd(firstOfMonthYmd)
  const todayYmd = getKoreaDateString()
  const monthStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}`

  async function fetchSchedules() {
    setLoading(true)
    const res = await fetch(`/api/schedule?month=${monthStr}`)
    const data: DailySchedule[] = await res.json()
    const grouped: Record<string, DailySchedule[]> = {}
    data.forEach((s) => {
      if (!grouped[s.schedule_date]) grouped[s.schedule_date] = []
      grouped[s.schedule_date].push(s)
    })
    setSchedules(grouped)
    setLoading(false)
  }

  async function fetchAvailable() {
    const res = await fetch('/api/questions?approved=true')
    const data = await res.json()
    setAvailableQuestions(Array.isArray(data) ? data : [])
  }

  useEffect(() => { fetchSchedules() }, [viewMonth, viewYear])
  useEffect(() => { fetchAvailable() }, [])

  const selectedSchedule = schedules[selectedDate] || []
  const scheduledIds = new Set(selectedSchedule.map((s) => s.question_id))
  const unscheduled = availableQuestions.filter((q) => !scheduledIds.has(q.id))

  async function addQuestion(questionId: string) {
    const sortOrder = selectedSchedule.length
    await fetch('/api/schedule', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ schedule_date: selectedDate, question_id: questionId, sort_order: sortOrder }),
    })
    fetchSchedules()
  }

  async function removeQuestion(questionId: string) {
    await fetch('/api/schedule', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ schedule_date: selectedDate, question_id: questionId }),
    })
    fetchSchedules()
  }

  const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">일정 관리</h1>

      <div className="bg-indigo-500/15 border border-indigo-500/40 rounded-xl p-4 text-sm text-slate-300">
        <p>
          <span className="text-indigo-300 font-semibold">매일 자동:</span> 한국시간 오전 8시경 Vercel Cron이{' '}
          과목마다 AI 문제 10개를 만들고 자동 승인한 뒤, 그날 일정에만 넣습니다. 수동으로 날짜·문항을 바꾸는 것도
          가능합니다(다음날 자동 생성 전까지 유지).
        </p>
      </div>

      <div className="grid grid-cols-[1fr_360px] gap-6">
        {/* Calendar */}
        <div className="bg-slate-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={() => { if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1) } else setViewMonth(m => m - 1) }}
              className="p-2 text-slate-400 hover:text-white"
            >←</button>
            <h2 className="text-white font-semibold">{viewYear}년 {viewMonth + 1}월</h2>
            <button
              onClick={() => { if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1) } else setViewMonth(m => m + 1) }}
              className="p-2 text-slate-400 hover:text-white"
            >→</button>
          </div>

          <div className="grid grid-cols-7 gap-1 mb-2">
            {WEEKDAYS.map((d) => (
              <div key={d} className="text-center text-xs text-slate-500 py-1">{d}</div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: firstDayOfWeek }).map((_, i) => (
              <div key={`empty-${i}`} />
            ))}
            {monthCells.map(({ ymd: dateStr, dayNum }) => {
              const count = schedules[dateStr]?.length || 0
              const isSelected = dateStr === selectedDate
              const isToday = dateStr === todayYmd

              return (
                <button
                  key={dateStr}
                  onClick={() => setSelectedDate(dateStr)}
                  className={`aspect-square flex flex-col items-center justify-center rounded-lg text-sm transition-colors p-1 ${
                    isSelected ? 'bg-indigo-600 text-white' :
                    isToday ? 'bg-slate-600 text-white' :
                    'text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  <span>{dayNum}</span>
                  {count > 0 && (
                    <span className={`text-[10px] mt-0.5 ${isSelected ? 'text-indigo-200' : 'text-indigo-400'}`}>
                      {count}문제
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* Day Editor */}
        <div className="space-y-4">
          <div className="bg-slate-800 rounded-xl p-4">
            <h3 className="font-semibold text-white mb-3">
              {selectedDate} 배정된 문제 ({selectedSchedule.length})
            </h3>
            {selectedSchedule.length === 0 ? (
              <p className="text-slate-500 text-sm">배정된 문제가 없습니다</p>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {selectedSchedule.map((s) => (
                  <div key={s.id} className="flex items-center gap-2 text-sm">
                    <span
                      className="px-2 py-0.5 rounded text-xs text-white font-medium shrink-0"
                      style={{ backgroundColor: s.question?.subject?.color_hex || '#6366f1' }}
                    >
                      {s.question?.subject?.name_ko}
                    </span>
                    <span className="text-slate-300 flex-1 truncate">{s.question?.question_text}</span>
                    <button
                      onClick={() => removeQuestion(s.question_id)}
                      className="text-red-400 hover:text-red-300 shrink-0"
                    >×</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-slate-800 rounded-xl p-4">
            <h3 className="font-semibold text-white mb-3">추가할 수 있는 문제</h3>
            {unscheduled.length === 0 ? (
              <p className="text-slate-500 text-sm">모든 승인된 문제가 배정되었습니다</p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {SUBJECTS.map((subject) => {
                  const subjectQuestions = unscheduled.filter((q) => q.subject_id === subject.id)
                  if (subjectQuestions.length === 0) return null
                  return (
                    <div key={subject.id}>
                      <div className="text-xs font-semibold text-slate-500 uppercase mb-1">{subject.nameKo}</div>
                      {subjectQuestions.slice(0, 5).map((q) => (
                        <button
                          key={q.id}
                          onClick={() => addQuestion(q.id)}
                          className="w-full text-left text-xs p-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 mb-1 truncate"
                        >
                          + {q.question_text}
                        </button>
                      ))}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
