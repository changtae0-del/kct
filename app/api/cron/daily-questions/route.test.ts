import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/supabase-server', () => ({
  createServerSupabase: vi.fn(),
}))

vi.mock('@/lib/daily-ai-generation', () => ({
  runDailyAiQuestionJob: vi.fn().mockResolvedValue({
    scheduleDate: '2025-12-01',
    subjectsOk: 7,
    questionsCreated: 70,
    scheduleRows: 70,
    errors: [],
  }),
}))

describe('GET /api/cron/daily-questions', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.stubEnv('CRON_SECRET', 'test-cron-secret')
    vi.stubEnv('OPENAI_API_KEY', 'sk-test')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('CRON_SECRET 없으면 500', async () => {
    vi.unstubAllEnvs()
    vi.stubEnv('OPENAI_API_KEY', 'sk-test')
    const { GET } = await import('./route')
    const res = await GET(new NextRequest('http://localhost/api/cron/daily-questions'))
    expect(res.status).toBe(500)
  })

  it('Authorization 없으면 401', async () => {
    const { GET } = await import('./route')
    const res = await GET(new NextRequest('http://localhost/api/cron/daily-questions'))
    expect(res.status).toBe(401)
  })

  it('잘못된 Bearer면 401', async () => {
    const { GET } = await import('./route')
    const res = await GET(
      new NextRequest('http://localhost/api/cron/daily-questions', {
        headers: { authorization: 'Bearer wrong' },
      })
    )
    expect(res.status).toBe(401)
  })

  it('올바른 Bearer면 200 및 job 결과', async () => {
    const { GET } = await import('./route')
    const res = await GET(
      new NextRequest('http://localhost/api/cron/daily-questions', {
        headers: { authorization: 'Bearer test-cron-secret' },
      })
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.subjectsOk).toBe(7)
    expect(body.questionsCreated).toBe(70)
  })
})
