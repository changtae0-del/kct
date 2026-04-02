'use client'

import { useState } from 'react'

export default function TriggerVercelDeployButton() {
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  async function run() {
    if (!confirm('Vercel 프로덕션 배포를 시작할까요? (몇 분 걸릴 수 있습니다)')) return
    setBusy(true)
    setMsg(null)
    try {
      const res = await fetch('/api/admin/trigger-vercel-deploy', {
        method: 'POST',
        credentials: 'include',
      })
      const data = await res.json()
      if (!res.ok) {
        setMsg(typeof data.error === 'string' ? data.error : JSON.stringify(data))
        return
      }
      setMsg('배포가 시작되었습니다. Vercel 대시보드에서 진행 상황을 확인하세요.')
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
        className="w-full flex items-center gap-3 p-3 rounded-lg bg-slate-600 hover:bg-slate-500 disabled:bg-slate-700 disabled:text-slate-500 transition-colors text-white text-left border border-slate-500"
      >
        <span>🚀</span>
        <span className="text-sm font-medium flex-1">
          {busy ? '배포 요청 중…' : 'Vercel 프로덕션 배포 (업) 실행'}
        </span>
      </button>
      {msg && <p className="text-xs text-slate-400 whitespace-pre-wrap break-words">{msg}</p>}
      <p className="text-[11px] text-slate-500">
        Vercel &gt; 프로젝트 &gt; Settings &gt; Git &gt; Deploy Hooks 에서 훅을 만든 뒤, 환경 변수{' '}
        <code className="text-slate-400">VERCEL_DEPLOY_HOOK_URL</code> 에 넣어야 동작합니다.
      </p>
    </div>
  )
}
