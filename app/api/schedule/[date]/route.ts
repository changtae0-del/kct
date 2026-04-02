import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase-server'

export async function GET(_: NextRequest, { params }: { params: Promise<{ date: string }> }) {
  const { date } = await params
  const db = createServerSupabase()

  const { data, error } = await db
    .from('daily_schedules')
    .select('*, question:questions(*, subject:subjects(*))')
    .eq('schedule_date', date)
    .order('sort_order')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const approvedOnly = (data || []).filter((row) => row.question?.is_approved)
  return NextResponse.json(approvedOnly)
}
