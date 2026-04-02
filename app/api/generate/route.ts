import { NextRequest, NextResponse } from 'next/server'
import { generateQuestions } from '@/lib/openai'
import { DIFFICULTY_LABELS } from '@/lib/constants'

export async function POST(request: NextRequest) {
  const { subjectNameKo, difficulty, count } = await request.json()

  if (!subjectNameKo || !difficulty || !count) {
    return NextResponse.json({ error: '필수 파라미터가 없습니다' }, { status: 400 })
  }

  const difficultyLabel = DIFFICULTY_LABELS[difficulty] || '쉬움'

  try {
    const questions = await generateQuestions(subjectNameKo, difficultyLabel, count)
    return NextResponse.json({ questions })
  } catch (err) {
    const message = err instanceof Error ? err.message : '알 수 없는 오류'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
