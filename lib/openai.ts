import OpenAI from 'openai'
import { GeneratedQuestion } from '@/types'
import { SUBJECTS, buildAIPrompt, buildDailyPackPrompt } from './constants'

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
const MAX_GENERATION_ATTEMPTS = 3

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0
}

function normalizeQuestion(raw: unknown): GeneratedQuestion | null {
  if (!raw || typeof raw !== 'object') return null
  const q = raw as Record<string, unknown>
  const correct = Number(q.correct_answer)
  const candidate: GeneratedQuestion = {
    question_text: String(q.question_text || '').trim(),
    option_1: String(q.option_1 || '').trim(),
    option_2: String(q.option_2 || '').trim(),
    option_3: String(q.option_3 || '').trim(),
    option_4: String(q.option_4 || '').trim(),
    correct_answer: correct as 1 | 2 | 3 | 4,
    explanation: String(q.explanation || '').trim(),
  }

  if (!isNonEmptyString(candidate.question_text)) return null
  if (!isNonEmptyString(candidate.option_1)) return null
  if (!isNonEmptyString(candidate.option_2)) return null
  if (!isNonEmptyString(candidate.option_3)) return null
  if (!isNonEmptyString(candidate.option_4)) return null
  if (!isNonEmptyString(candidate.explanation)) return null
  if (![1, 2, 3, 4].includes(correct)) return null

  const uniqueOptions = new Set([
    candidate.option_1,
    candidate.option_2,
    candidate.option_3,
    candidate.option_4,
  ])
  if (uniqueOptions.size < 4) return null

  return candidate
}

function validateQuestions(
  parsed: unknown,
  expectedCount: number
): { ok: true; questions: GeneratedQuestion[] } | { ok: false; reason: string } {
  if (!parsed || typeof parsed !== 'object') {
    return { ok: false, reason: '응답 JSON이 객체가 아닙니다' }
  }

  const items = (parsed as Record<string, unknown>).questions
  if (!Array.isArray(items)) {
    return { ok: false, reason: 'questions 배열이 없습니다' }
  }
  if (items.length < expectedCount) {
    return { ok: false, reason: `문항 수 부족 (${items.length}/${expectedCount})` }
  }

  const normalized: GeneratedQuestion[] = []
  for (const item of items.slice(0, expectedCount)) {
    const q = normalizeQuestion(item)
    if (!q) return { ok: false, reason: '문항 필드/형식 검증 실패' }
    normalized.push(q)
  }

  const uniqueStems = new Set(normalized.map((q) => q.question_text))
  if (uniqueStems.size !== normalized.length) {
    return { ok: false, reason: '중복 문제 감지' }
  }

  return { ok: true, questions: normalized }
}

function validateDailyPack(
  parsed: unknown,
  perSubject: number
):
  | { ok: true; bySubject: Record<string, GeneratedQuestion[]> }
  | { ok: false; reason: string } {
  if (!parsed || typeof parsed !== 'object') {
    return { ok: false, reason: '응답 JSON이 객체가 아닙니다' }
  }
  const root = parsed as Record<string, unknown>
  const bag = root.questions_by_subject
  if (!bag || typeof bag !== 'object' || Array.isArray(bag)) {
    return { ok: false, reason: 'questions_by_subject 객체가 없습니다' }
  }

  const bySubject: Record<string, GeneratedQuestion[]> = {}
  const globalStems = new Set<string>()

  for (const s of SUBJECTS) {
    const rawArr = (bag as Record<string, unknown>)[s.nameKo]
    if (!Array.isArray(rawArr)) {
      return { ok: false, reason: `${s.nameKo}: 배열 없음` }
    }
    if (rawArr.length < perSubject) {
      return { ok: false, reason: `${s.nameKo}: 문항 수 부족 (${rawArr.length}/${perSubject})` }
    }

    const list: GeneratedQuestion[] = []
    for (const item of rawArr.slice(0, perSubject)) {
      const q = normalizeQuestion(item)
      if (!q) return { ok: false, reason: `${s.nameKo}: 문항 형식 오류` }
      if (globalStems.has(q.question_text)) {
        return { ok: false, reason: '과목 간 중복 문제 감지' }
      }
      globalStems.add(q.question_text)
      list.push(q)
    }
    bySubject[s.nameKo] = list
  }

  return { ok: true, bySubject }
}

/** Cron용: 과목 7개를 OpenAI 한 번에 생성 (실행 시간·실패율 개선) */
export async function generateDailyPack(
  difficultyLabel: string,
  perSubject: number
): Promise<Record<string, GeneratedQuestion[]>> {
  let lastError = '알 수 없는 오류'

  for (let attempt = 1; attempt <= MAX_GENERATION_ATTEMPTS; attempt++) {
    try {
      const completion = await client.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content:
              '당신은 한국 중학교 검정고시 전문 출제 AI입니다. 정확하고 교육적인 문제를 만들어주세요.',
          },
          {
            role: 'user',
            content: buildDailyPackPrompt(difficultyLabel, perSubject),
          },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.35,
      })

      const content = completion.choices[0].message.content
      if (!content) throw new Error('OpenAI 응답이 비어있습니다')

      const parsed = JSON.parse(content)
      const validated = validateDailyPack(parsed, perSubject)
      if (!validated.ok) {
        throw new Error(`생성 결과 검증 실패: ${validated.reason}`)
      }

      return validated.bySubject
    } catch (e) {
      lastError = e instanceof Error ? e.message : '알 수 없는 오류'
    }
  }

  throw new Error(`일일 묶음 생성 실패(재시도 ${MAX_GENERATION_ATTEMPTS}회): ${lastError}`)
}

export async function generateQuestions(
  subjectNameKo: string,
  difficultyLabel: string,
  count: number
): Promise<GeneratedQuestion[]> {
  let lastError = '알 수 없는 오류'

  for (let attempt = 1; attempt <= MAX_GENERATION_ATTEMPTS; attempt++) {
    try {
      const completion = await client.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: '당신은 한국 중학교 검정고시 전문 출제 AI입니다. 정확하고 교육적인 문제를 만들어주세요.',
          },
          {
            role: 'user',
            content: buildAIPrompt(subjectNameKo, difficultyLabel, count),
          },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.35,
      })

      const content = completion.choices[0].message.content
      if (!content) throw new Error('OpenAI 응답이 비어있습니다')

      const parsed = JSON.parse(content)
      const validated = validateQuestions(parsed, count)
      if (!validated.ok) {
        throw new Error(`생성 결과 검증 실패: ${validated.reason}`)
      }

      return validated.questions
    } catch (e) {
      lastError = e instanceof Error ? e.message : '알 수 없는 오류'
    }
  }

  throw new Error(`문제 생성 실패(재시도 ${MAX_GENERATION_ATTEMPTS}회): ${lastError}`)
}
