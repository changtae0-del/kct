'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'

const NAV_ITEMS = [
  { href: '/admin/dashboard', label: '대시보드', icon: '📊' },
  { href: '/admin/questions', label: '문제 은행', icon: '📝' },
  { href: '/admin/generate', label: 'AI 문제 생성', icon: '🤖' },
  { href: '/admin/schedule', label: '일정 관리', icon: '📅' },
  { href: '/admin/analytics', label: '성적 분석', icon: '📈' },
]

export default function AdminNav() {
  const pathname = usePathname()
  const router = useRouter()

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
    router.refresh()
  }

  return (
    <nav className="w-56 min-h-screen bg-slate-800 border-r border-slate-700 flex flex-col">
      <div className="p-5 border-b border-slate-700">
        <div className="text-xl font-bold text-white">📚 검정고시 앱</div>
        <div className="text-slate-400 text-xs mt-1">관리자 패널</div>
      </div>

      <div className="flex-1 p-3 space-y-1">
        {NAV_ITEMS.map(({ href, label, icon }) => (
          <Link
            key={href}
            href={href}
            className={`flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium transition-colors ${
              pathname.startsWith(href)
                ? 'bg-indigo-600 text-white'
                : 'text-slate-400 hover:bg-slate-700 hover:text-white'
            }`}
          >
            <span>{icon}</span>
            {label}
          </Link>
        ))}
      </div>

      <div className="p-3 border-t border-slate-700">
        <button
          onClick={handleLogout}
          className="w-full text-left flex items-center gap-3 px-3 py-3 rounded-lg text-sm text-slate-400 hover:bg-slate-700 hover:text-white transition-colors"
        >
          <span>🚪</span>
          로그아웃
        </button>
      </div>
    </nav>
  )
}
