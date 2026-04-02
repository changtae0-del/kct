import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase-server'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const date = searchParams.get('date')
  const db = createServerSupabase()

  let query = db
    .from('study_sessions')
    .select('*')
    .order('started_at', { ascending: false })

  if (date) query = query.eq('session_date', date)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: NextRequest) {
  const { session_date, total_questions } = await request.json()
  const db = createServerSupabase()

  const { data, error } = await db
    .from('study_sessions')
    .insert({ session_date, total_questions })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
