import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase-server'
import { getKoreaDateString } from '@/lib/korea-date'

export async function GET() {
  const db = createServerSupabase()
  const date = getKoreaDateString()

  const { count, error } = await db
    .from('daily_schedules')
    .select('*', { count: 'exact', head: true })
    .eq('schedule_date', date)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const todayCount = count || 0
  return NextResponse.json({
    date,
    ready: todayCount > 0,
    count: todayCount,
  })
}
