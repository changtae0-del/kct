import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase-server'

export async function POST(request: NextRequest) {
  const body = await request.json()
  // body: { session_id, question_id, selected_answer, is_correct, time_taken_ms }
  const db = createServerSupabase()

  const { data, error } = await db
    .from('user_answers')
    .insert(body)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
