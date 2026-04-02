import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase-server'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const month = searchParams.get('month') // 'YYYY-MM'

  const db = createServerSupabase()
  let query = db
    .from('daily_schedules')
    .select('*, question:questions(*, subject:subjects(*))')
    .order('sort_order')

  if (month) {
    query = query
      .gte('schedule_date', `${month}-01`)
      .lte('schedule_date', `${month}-31`)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  // body: { schedule_date, question_id, sort_order? }
  const db = createServerSupabase()

  const { data, error } = await db
    .from('daily_schedules')
    .upsert(body, { onConflict: 'schedule_date,question_id' })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}

export async function DELETE(request: NextRequest) {
  const { schedule_date, question_id } = await request.json()
  const db = createServerSupabase()

  const { error } = await db
    .from('daily_schedules')
    .delete()
    .eq('schedule_date', schedule_date)
    .eq('question_id', question_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
