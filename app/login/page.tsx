'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { KOREA_TIME_ZONE } from '@/lib/korea-date'

type RoleOption = 'admin' | 'student'

export default function LoginPage() {
  const router = useRouter()
  const [selectedRole, setSelectedRole] = useState<RoleOption | null>(null)
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [now, setNow] = useState(() => new Date())
  const [todayReady, setTodayReady] = useState(false)

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    let cancelled = false

    async function checkTodayReady() {
      try {
        const res = await fetch('/api/schedule/today-ready', { cache: 'no-store' })
        const data = await res.json()
        if (!cancelled) setTodayReady(Boolean(data?.ready))
      } catch {
        if (!cancelled) setTodayReady(false)
      }
    }

    checkTodayReady()
    const id = setInterval(checkTodayReady, 60000)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [])

  const datePart = now.toLocaleDateString('ko-KR', {
    timeZone: KOREA_TIME_ZONE,
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  })
  /* sv-SE는 24시각 HH:mm:ss로 고정되어 큰 숫자 시계에 적합 (시간대는 Asia/Seoul) */
  const timePart = new Intl.DateTimeFormat('sv-SE', {
    timeZone: KOREA_TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(now)
  const koreaHour = Number(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: KOREA_TIME_ZONE,
      hour: '2-digit',
      hour12: false,
    }).format(now)
  )
  const isStudyTime = koreaHour >= 9 && koreaHour <= 16
  const isNoticeWindow = koreaHour >= 8 && koreaHour < 16
  const showArrivalNotice = todayReady && isNoticeWindow

  // D-day 계산 함수
  const calculateDDay = (targetMonth: number, targetDay: number) => {
    const today = new Date(now.toLocaleDateString('en-CA', { timeZone: KOREA_TIME_ZONE }))
    const year = today.getFullYear()
    const targetDate = new Date(year, targetMonth - 1, targetDay)

    // 이미 지난 경우 다음 해로 설정
    if (targetDate < today) {
      targetDate.setFullYear(year + 1)
    }

    const timeDiff = targetDate.getTime() - today.getTime()
    const dDay = Math.ceil(timeDiff / (1000 * 60 * 60 * 24))
    return dDay
  }

  const applicationDDay = calculateDDay(6, 1) // 6월 1일
  const examDDay = calculateDDay(8, 1) // 8월 1일

  async function handleLogin() {
    if (!selectedRole || !password) return
    setLoading(true)
    setError('')

    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: selectedRole, password }),
    })

    if (res.ok) {
      router.push(selectedRole === 'admin' ? '/admin/dashboard' : '/student/today')
      router.refresh()
    } else {
      const data = await res.json()
      setError(data.error || '로그인에 실패했습니다')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 p-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <div className="text-5xl mb-4">📚</div>
          <h1 className="text-3xl font-bold text-white">검정고시 앱</h1>
          <p className="text-slate-400 mt-2">중학교 검정고시 기출문제 연습</p>

          {/* D-day 정보 */}
          <div className="mt-3 space-y-1 text-xs sm:text-sm" suppressHydrationWarning>
            <p className="text-cyan-300 font-semibold">📝 접수기간 D-{applicationDDay}</p>
            <p className="text-purple-300 font-semibold">🎯 검정고시 D-{examDDay}</p>
          </div>

          {showArrivalNotice && (
            <p className="mt-3 text-yellow-300 font-semibold text-base sm:text-lg">
              오늘 문제가 도착했습니다! 열어보세요!
            </p>
          )}
          <div
            className="mt-6 rounded-2xl border border-indigo-500/30 bg-slate-800/90 px-4 py-5 shadow-lg shadow-indigo-950/40"
            suppressHydrationWarning
          >
            <p className="text-slate-400 text-sm sm:text-base font-medium leading-snug">{datePart}</p>
            <p
              className={`mt-2 text-4xl sm:text-5xl md:text-6xl font-bold tabular-nums tracking-tight font-mono leading-none ${
                isStudyTime
                  ? 'text-green-300 drop-shadow-[0_0_24px_rgba(74,222,128,0.45)]'
                  : 'text-red-300 drop-shadow-[0_0_24px_rgba(248,113,113,0.45)]'
              }`}
              suppressHydrationWarning
            >
              {timePart}
            </p>
            <p className="text-indigo-300/90 text-xs sm:text-sm font-semibold mt-3 tracking-wide">한국시간 · 초 단위 갱신</p>
          </div>
        </div>

        <div className="bg-slate-800 rounded-2xl p-6 space-y-5">
          {/* Role Selection */}
          <div>
            <p className="text-slate-400 text-sm mb-3">누구로 접속할까요?</p>
            <div className="grid grid-cols-2 gap-3">
              {([
                { role: 'admin' as const, label: '👨‍💼 아빠 (관리자)', desc: '문제 관리' },
                { role: 'student' as const, label: '📖 딸 (학생)', desc: '문제 풀기' },
              ]).map(({ role, label, desc }) => (
                <button
                  key={role}
                  onClick={() => { setSelectedRole(role); setError('') }}
                  className={`p-4 rounded-xl border-2 text-left transition-all active:scale-95 ${
                    selectedRole === role
                      ? 'border-indigo-500 bg-indigo-500/20 text-white'
                      : 'border-slate-600 text-slate-400 hover:border-slate-500'
                  }`}
                >
                  <div className="font-semibold text-sm">{label}</div>
                  <div className="text-xs mt-1 opacity-70">{desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Password */}
          {selectedRole && (
            <div>
              <label className="text-slate-400 text-sm block mb-2">비밀번호</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                placeholder="비밀번호를 입력하세요"
                className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 text-lg"
                autoFocus
              />
            </div>
          )}

          {error && (
            <p className="text-red-400 text-sm text-center">{error}</p>
          )}

          <button
            onClick={handleLogin}
            disabled={!selectedRole || !password || loading}
            className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 disabled:text-slate-500 text-white font-semibold py-4 rounded-xl transition-all active:scale-95 text-lg"
          >
            {loading ? '로그인 중...' : '로그인'}
          </button>
        </div>
      </div>
    </div>
  )
}
