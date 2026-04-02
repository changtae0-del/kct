import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase-server'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const subjectId = searchParams.get('subject_id')
  const approvedOnly = searchParams.get('approved') === 'true'

  const db = createServerSupabase()
  let query = db
    .from('questions')
    .select('*, subject:subjects(*)')
    .order('created_at', { ascending: false })

  if (subjectId) query = query.eq('subject_id', subjectId)
  if (approvedOnly) query = query.eq('is_approved', true)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const db = createServerSupabase()

  const { data, error } = await db
    .from('questions')
    .insert(body)
    .select('*, subject:subjects(*)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
