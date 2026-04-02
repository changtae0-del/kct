import { createClient } from '@supabase/supabase-js'
import { MockExamSubjectResult, Subject } from '@/types'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface MockExamResult {
  session_id: string
  total_score: number
  max_score: number
  average_percentage: number
  subject_results: (MockExamSubjectResult & { subject: Subject })[]
}

export async function GET(
  request: Request,
  { params }: { params: { setId: string; sessionId: string } }
) {
  try {
    const { setId, sessionId } = params

    // 과목별 결과 조회
    const { data: subjectResults, error: resultsError } = await supabase
      .from('mock_exam_subject_results')
      .select(
        `
        id,
        session_id,
        subject_id,
        total_questions,
        correct_count,
        score_percentage,
        time_limit_seconds,
        time_used_seconds,
        created_at,
        subjects(id, code, name_ko, color_hex, sort_order)
      `
      )
      .eq('session_id', sessionId)
      .order('subjects(sort_order)', { ascending: true })

    if (resultsError) {
      console.error('Error fetching results:', resultsError)
      return Response.json({ error: resultsError.message }, { status: 500 })
    }

    // 결과 계산
    let totalScore = 0
    let maxScore = 0
    const processedResults: (MockExamSubjectResult & { subject: Subject })[] = []

    subjectResults?.forEach((result: any) => {
      const correctCount = result.correct_count || 0
      const totalQuestions = result.total_questions || 0
      const scoreValue = correctCount * 10 // 문제당 10점 기준

      totalScore += scoreValue
      maxScore += totalQuestions * 10

      processedResults.push({
        id: result.id,
        session_id: result.session_id,
        subject_id: result.subject_id,
        total_questions: totalQuestions,
        correct_count: correctCount,
        score_percentage: result.score_percentage,
        time_limit_seconds: result.time_limit_seconds,
        time_used_seconds: result.time_used_seconds,
        created_at: result.created_at,
        subject: result.subjects,
      })
    })

    const averagePercentage =
      maxScore > 0 ? (totalScore / maxScore) * 100 : 0

    const resultData: MockExamResult = {
      session_id: sessionId,
      total_score: totalScore,
      max_score: maxScore,
      average_percentage: Math.round(averagePercentage * 100) / 100,
      subject_results: processedResults,
    }

    return Response.json(resultData, { status: 200 })
  } catch (error) {
    console.error('Unexpected error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// 최종 결과를 바탕으로 시도 기록 생성
export async function POST(
  request: Request,
  { params }: { params: { setId: string; sessionId: string } }
) {
  try {
    const { setId, sessionId } = params

    // 먼저 최종 결과 계산
    const resultsResponse = await GET(request, { params: { setId, sessionId } })
    const results = (await resultsResponse.json()) as MockExamResult

    // 시도 기록 저장
    const { data, error } = await supabase
      .from('mock_exam_attempt_history')
      .insert({
        mock_exam_set_id: setId,
        session_id: sessionId,
        total_score: results.total_score,
        average_percentage: results.average_percentage,
      })
      .select()
      .single()

    if (error) {
      console.error('Error saving attempt history:', error)
      return Response.json({ error: error.message }, { status: 500 })
    }

    return Response.json(data, { status: 201 })
  } catch (error) {
    console.error('Unexpected error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
