import type { SupabaseClient } from '@supabase/supabase-js'
import { generateDailyPack } from '@/lib/openai'
import { AUTO_SCHEDULE_QUESTIONS_PER_SUBJECT, DIFFICULTY_LABELS, SUBJECTS } from '@/lib/constants'
import type { GeneratedQuestion } from '@/types'

const DEFAULT_DIFFICULTY = 1 as const

function rowsFromGenerated(
  subjectId: number,
  list: GeneratedQuestion[]
): Record<string, unknown>[] {
  return list.map((q) => ({
    subject_id: subjectId,
    difficulty: DEFAULT_DIFFICULTY,
    question_text: q.question_text,
    option_1: q.option_1,
    option_2: q.option_2,
    option_3: q.option_3,
    option_4: q.option_4,
    correct_answer: q.correct_answer,
    explanation: q.explanation ?? null,
    source_type: 'ai',
    is_approved: true,
  }))
}

/**
 * 해당 날짜 일정을 비우고, 과목별로 AI 문제를 생성·자동 승인 후 일정에 연결합니다.
 */
export async function runDailyAiQuestionJob(
  db: SupabaseClient,
  scheduleDate: string
): Promise<{
  scheduleDate: string
  subjectsOk: number
  questionsCreated: number
  scheduleRows: number
  errors: string[]
}> {
  const difficultyLabel = DIFFICULTY_LABELS[DEFAULT_DIFFICULTY]

  let pack: Record<string, GeneratedQuestion[]>
  try {
    pack = await generateDailyPack(difficultyLabel, AUTO_SCHEDULE_QUESTIONS_PER_SUBJECT)
  } catch (e) {
    const msg = e instanceof Error ? e.message : '알 수 없는 오류'
    throw new Error(`일일 문제 생성 실패: ${msg}`)
  }

  const { error: delError } = await db.from('daily_schedules').delete().eq('schedule_date', scheduleDate)
  if (delError) throw new Error(delError.message)

  const errors: string[] = []
  let sortOrder = 0
  let questionsCreated = 0
  let scheduleRows = 0
  let subjectsOk = 0

  for (const subject of SUBJECTS) {
    try {
      const generated = pack[subject.nameKo]
      if (!generated?.length) {
        errors.push(`${subject.nameKo}: 생성된 문제 없음`)
        continue
      }
      const toInsert = rowsFromGenerated(subject.id, generated)
      if (toInsert.length === 0) {
        errors.push(`${subject.nameKo}: 생성된 문제 없음`)
        continue
      }

      const { data: inserted, error: insQ } = await db.from('questions').insert(toInsert).select('id')
      if (insQ) {
        errors.push(`${subject.nameKo}: 저장 실패 ${insQ.message}`)
        continue
      }

      const ids = (inserted || []).map((r) => r.id)
      questionsCreated += ids.length

      const scheduleBatch = ids.map((question_id) => ({
        schedule_date: scheduleDate,
        question_id,
        sort_order: sortOrder++,
      }))

      const { error: insS } = await db.from('daily_schedules').insert(scheduleBatch)
      if (insS) {
        errors.push(`${subject.nameKo}: 일정 연결 실패 ${insS.message}`)
        continue
      }

      scheduleRows += scheduleBatch.length
      subjectsOk += 1
    } catch (e) {
      errors.push(`${subject.nameKo}: ${e instanceof Error ? e.message : '알 수 없는 오류'}`)
    }
  }

  return {
    scheduleDate,
    subjectsOk,
    questionsCreated,
    scheduleRows,
    errors,
  }
}
