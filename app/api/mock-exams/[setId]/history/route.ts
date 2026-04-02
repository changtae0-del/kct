import { createClient } from '@supabase/supabase-js'
import { MockExamAttemptHistory } from '@/types'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(
  request: Request,
  { params }: { params: { setId: string } }
) {
  try {
    const { setId } = params

    const { data, error } = await supabase
      .from('mock_exam_attempt_history')
      .select(
        'id, mock_exam_set_id, session_id, total_score, average_percentage, attempt_date'
      )
      .eq('mock_exam_set_id', setId)
      .order('attempt_date', { ascending: false })

    if (error) {
      console.error('Error fetching history:', error)
      return Response.json({ error: error.message }, { status: 500 })
    }

    return Response.json(data as MockExamAttemptHistory[], { status: 200 })
  } catch (error) {
    console.error('Unexpected error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
