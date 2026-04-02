import { createClient } from '@supabase/supabase-js'
import { MockExamSet } from '@/types'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('mock_exam_sets')
      .select('id, year, session_number, title, description, total_questions, created_at')
      .order('year', { ascending: false })
      .order('session_number', { ascending: false })

    if (error) {
      console.error('Error fetching mock exams:', error)
      return Response.json({ error: error.message }, { status: 500 })
    }

    return Response.json(data as MockExamSet[], { status: 200 })
  } catch (error) {
    console.error('Unexpected error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
