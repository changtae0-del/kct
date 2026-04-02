/**
 * .env.local 을 읽은 뒤 한국 날짜 "오늘"에 대해 Cron과 동일한 일일 생성·배정 실행
 * 사용: node scripts/run-today.mjs
 */
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'
import OpenAI from 'openai'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')

function loadEnvLocal() {
  const p = resolve(root, '.env.local')
  const raw = readFileSync(p, 'utf8')
  for (const line of raw.split('\n')) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const i = t.indexOf('=')
    if (i <= 0) continue
    const key = t.slice(0, i).trim()
    let val = t.slice(i + 1).trim()
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1)
    }
    process.env[key] = val
  }
}

loadEnvLocal()

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
const openaiKey = process.env.OPENAI_API_KEY
if (!url || !key) {
  console.error('NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 가 필요합니다.')
  process.exit(1)
}
if (!openaiKey) {
  console.error('OPENAI_API_KEY 가 필요합니다.')
  process.exit(1)
}

const SUBJECTS = [
  { id: 1, nameKo: '국어' },
  { id: 2, nameKo: '수학' },
  { id: 3, nameKo: '영어' },
  { id: 4, nameKo: '사회' },
  { id: 5, nameKo: '과학' },
  { id: 6, nameKo: '도덕' },
  { id: 7, nameKo: '역사' },
]
const PER_SUBJECT = 10
const DIFFICULTY = 1

function getKoreaDateString(d = new Date()) {
  return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' })
}

const buildDailyPackPrompt = () => {
  const names = SUBJECTS.map((s) => s.nameKo)
  const keysJson = JSON.stringify(names)
  return `당신은 한국 중학교 검정고시 문제를 만드는 전문가입니다.
아래 과목 각각에 대해 **정확히 ${PER_SUBJECT}개씩** 쉬움 난이도의 4지선다 문제를 만드세요.

과목 목록(키는 아래 한글 이름과 **완전히 동일**): ${names.join(', ')}

출제 기준:
- 검정고시·EBS·공식 교재 유형 참고, 특정 문장 복사 금지
- 보기 4개는 서로 다르고 정답 1개

반드시 아래 JSON만 출력:
{
  "questions_by_subject": {
    "국어": [ { "question_text": "", "option_1": "", "option_2": "", "option_3": "", "option_4": "", "correct_answer": 1, "explanation": "" } ]
  }
}

questions_by_subject의 키는 반드시 다음과 동일: ${keysJson}
각 배열 길이는 정확히 ${PER_SUBJECT}개.`
}

function normalizeQuestion(raw) {
  if (!raw || typeof raw !== 'object') return null
  const q = raw
  const correct = Number(q.correct_answer)
  const question_text = String(q.question_text || '').trim()
  const option_1 = String(q.option_1 || '').trim()
  const option_2 = String(q.option_2 || '').trim()
  const option_3 = String(q.option_3 || '').trim()
  const option_4 = String(q.option_4 || '').trim()
  const explanation = String(q.explanation || '').trim()
  if (!question_text || !option_1 || !option_2 || !option_3 || !option_4 || !explanation) return null
  if (![1, 2, 3, 4].includes(correct)) return null
  const opts = new Set([option_1, option_2, option_3, option_4])
  if (opts.size < 4) return null
  return { question_text, option_1, option_2, option_3, option_4, correct_answer: correct, explanation }
}

function validatePack(parsed) {
  const bag = parsed?.questions_by_subject
  if (!bag || typeof bag !== 'object' || Array.isArray(bag)) {
    return { ok: false, reason: 'questions_by_subject 없음' }
  }
  const bySubject = {}
  const globalStems = new Set()
  for (const s of SUBJECTS) {
    const rawArr = bag[s.nameKo]
    if (!Array.isArray(rawArr)) return { ok: false, reason: `${s.nameKo}: 배열 없음` }
    if (rawArr.length < PER_SUBJECT) {
      return { ok: false, reason: `${s.nameKo}: 수 부족 (${rawArr.length}/${PER_SUBJECT})` }
    }
    const list = []
    for (const item of rawArr.slice(0, PER_SUBJECT)) {
      const q = normalizeQuestion(item)
      if (!q) return { ok: false, reason: `${s.nameKo}: 형식 오류` }
      if (globalStems.has(q.question_text)) return { ok: false, reason: '중복 문항' }
      globalStems.add(q.question_text)
      list.push(q)
    }
    bySubject[s.nameKo] = list
  }
  return { ok: true, bySubject }
}

async function generatePack(client) {
  let last = ''
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const completion = await client.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: '당신은 한국 중학교 검정고시 전문 출제 AI입니다.',
          },
          { role: 'user', content: buildDailyPackPrompt() },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.35,
      })
      const content = completion.choices[0]?.message?.content
      if (!content) throw new Error('빈 응답')
      const parsed = JSON.parse(content)
      const v = validatePack(parsed)
      if (!v.ok) throw new Error(v.reason)
      return v.bySubject
    } catch (e) {
      last = e instanceof Error ? e.message : String(e)
    }
  }
  throw new Error(`생성 실패: ${last}`)
}

async function main() {
  const scheduleDate = getKoreaDateString()
  console.log('한국 날짜:', scheduleDate)

  const openai = new OpenAI({ apiKey: openaiKey })
  const pack = await generatePack(openai)
  console.log('OpenAI 묶음 생성 완료')

  const db = createClient(url, key, { auth: { persistSession: false } })

  const { error: delError } = await db.from('daily_schedules').delete().eq('schedule_date', scheduleDate)
  if (delError) throw delError

  let sortOrder = 0
  let questionsCreated = 0
  let scheduleRows = 0
  let subjectsOk = 0
  const errors = []

  for (const s of SUBJECTS) {
    try {
      const generated = pack[s.nameKo]
      const rows = generated.map((q) => ({
        subject_id: s.id,
        difficulty: DIFFICULTY,
        question_text: q.question_text,
        option_1: q.option_1,
        option_2: q.option_2,
        option_3: q.option_3,
        option_4: q.option_4,
        correct_answer: q.correct_answer,
        explanation: q.explanation,
        source_type: 'ai',
        is_approved: true,
      }))
      const { data: inserted, error: insQ } = await db.from('questions').insert(rows).select('id')
      if (insQ) {
        errors.push(`${s.nameKo}: ${insQ.message}`)
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
        errors.push(`${s.nameKo} 일정: ${insS.message}`)
        continue
      }
      scheduleRows += scheduleBatch.length
      subjectsOk++
    } catch (e) {
      errors.push(`${s.nameKo}: ${e instanceof Error ? e.message : e}`)
    }
  }

  const result = { scheduleDate, subjectsOk, questionsCreated, scheduleRows, errors }
  console.log(JSON.stringify(result, null, 2))
  if (subjectsOk === 0) process.exit(1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
