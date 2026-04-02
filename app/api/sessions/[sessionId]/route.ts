import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase-server'

export async function GET(_: NextRequest, { params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params
  const db = createServerSupabase()

  const [sessionRes, answersRes] = await Promise.all([
    db.from('study_sessions').select('*').eq('id', sessionId).single(),
    db
      .from('user_answers')
      .select('*, question:questions(*, subject:subjects(*))')
      .eq('session_id', sessionId)
      .order('answered_at'),
  ])

  if (sessionRes.error) return NextResponse.json({ error: sessionRes.error.message }, { status: 404 })
  return NextResponse.json({ session: sessionRes.data, answers: answersRes.data || [] })
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params
  const body = await request.json()
  const db = createServerSupabase()

  // Calculate score if completing
  if (body.is_completed) {
    const { data: session } = await db
      .from('study_sessions')
      .select('total_questions')
      .eq('id', sessionId)
      .single()

    const { count: correctCount } = await db
      .from('user_answers')
      .select('*', { count: 'exact', head: true })
      .eq('session_id', sessionId)
      .eq('is_correct', true)

    const totalQ = session?.total_questions || 1
    const correct = correctCount || 0
    body.correct_count = correct
    body.score_pct = Math.round((correct / totalQ) * 100 * 10) / 10
    body.completed_at = new Date().toISOString()
  }

  const { data, error } = await db
    .from('study_sessions')
    .update(body)
    .eq('id', sessionId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
