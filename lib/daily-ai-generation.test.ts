import { describe, expect, it, vi, beforeEach } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { runDailyAiQuestionJob } from '@/lib/daily-ai-generation'
import { SUBJECTS, AUTO_SCHEDULE_QUESTIONS_PER_SUBJECT } from '@/lib/constants'
import * as openai from '@/lib/openai'

vi.mock('@/lib/openai')

function sampleGenerated(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    question_text: `문항 ${i}`,
    option_1: '①',
    option_2: '②',
    option_3: '③',
    option_4: '④',
    correct_answer: 1 as const,
    explanation: '해설',
  }))
}

function createMockSupabase() {
  let qId = 0
  const state = {
    deletedForDate: null as string | null,
    questionBatches: [] as Record<string, unknown>[][],
    scheduleBatches: [] as unknown[][],
  }

  const client = {
    from(table: string) {
      if (table === 'daily_schedules') {
        return {
          delete() {
            return {
              eq(_c: string, date: string) {
                state.deletedForDate = date
                return Promise.resolve({ error: null })
              },
            }
          },
          insert(rows: unknown[]) {
            state.scheduleBatches.push(rows as unknown[])
            return Promise.resolve({ error: null })
          },
        }
      }
      if (table === 'questions') {
        return {
          insert(rows: Record<string, unknown>[]) {
            state.questionBatches.push(rows)
            const data = rows.map(() => ({ id: `q-${++qId}` }))
            return {
              select(_col: string) {
                return Promise.resolve({ data, error: null })
              },
            }
          },
        }
      }
      throw new Error(`unexpected table ${table}`)
    },
  }

  return { client: client as unknown as SupabaseClient, state }
}

describe('runDailyAiQuestionJob', () => {
  beforeEach(() => {
    const pack = Object.fromEntries(
      SUBJECTS.map((s) => [s.nameKo, sampleGenerated(AUTO_SCHEDULE_QUESTIONS_PER_SUBJECT)])
    )
    vi.mocked(openai.generateDailyPack).mockResolvedValue(pack)
  })

  it('해당 날짜 일정을 지우고 과목 수만큼 생성·승인·일정 삽입', async () => {
    const { client, state } = createMockSupabase()
    const result = await runDailyAiQuestionJob(client, '2025-06-20')

    expect(state.deletedForDate).toBe('2025-06-20')
    expect(openai.generateDailyPack).toHaveBeenCalledTimes(1)
    expect(state.questionBatches.length).toBe(SUBJECTS.length)
    expect(state.questionBatches.every((b) => b.length === AUTO_SCHEDULE_QUESTIONS_PER_SUBJECT)).toBe(true)
    expect(state.questionBatches[0].every((row) => row.is_approved === true)).toBe(true)
    expect(state.scheduleBatches.length).toBe(SUBJECTS.length)
    const totalSchedule = state.scheduleBatches.reduce((n, b) => n + b.length, 0)
    expect(totalSchedule).toBe(SUBJECTS.length * AUTO_SCHEDULE_QUESTIONS_PER_SUBJECT)

    expect(result.subjectsOk).toBe(SUBJECTS.length)
    expect(result.questionsCreated).toBe(totalSchedule)
    expect(result.scheduleRows).toBe(totalSchedule)
    expect(result.errors).toEqual([])
  })
})
