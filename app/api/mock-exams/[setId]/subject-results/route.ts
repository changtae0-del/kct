import { createClient } from '@supabase/supabase-js'
import { MockExamSubjectResult } from '@/types'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(
  request: Request,
  { params }: { params: Promise<{ setId: string }> }
) {
  try {
    const { setId } = await params
    const body = await request.json()
    const {
      session_id,
      subject_id,
      total_questions,
      correct_count,
      time_limit_seconds,
      time_used_seconds,
    } = body

    // 유효성 검사
    if (!session_id || !subject_id || !total_questions || correct_count === undefined) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // 점수 계산
    const score_percentage = (correct_count / total_questions) * 100

    // 데이터 저장
    const { data, error } = await supabase
      .from('mock_exam_subject_results')
      .insert({
        session_id,
        subject_id,
        total_questions,
        correct_count,
        score_percentage,
        time_limit_seconds,
        time_used_seconds,
      })
      .select()
      .single()

    if (error) {
      console.error('Error saving subject result:', error)
      return Response.json({ error: error.message }, { status: 500 })
    }

    return Response.json(data as MockExamSubjectResult, { status: 201 })
  } catch (error) {
    console.error('Unexpected error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
