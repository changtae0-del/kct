export const dynamic = 'force-dynamic'
import { createServerSupabase } from '@/lib/supabase-server'
import QuestionForm from '@/components/admin/QuestionForm'
import { notFound } from 'next/navigation'

export default async function EditQuestionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const db = createServerSupabase()
  const { data: question, error } = await db
    .from('questions')
    .select('*, subject:subjects(*)')
    .eq('id', id)
    .single()

  if (error || !question) notFound()

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">문제 편집</h1>
      <QuestionForm question={question} />
    </div>
  )
}
