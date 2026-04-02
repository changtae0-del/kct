import { createClient } from '@supabase/supabase-js'
import { MockExamSet, MockExamQuestion, Subject, Question } from '@/types'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface MockExamDetail extends MockExamSet {
  subjects: (Subject & { questions: Question[] })[]
}

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params

    // 모의고사 정보 조회
    const { data: examData, error: examError } = await supabase
      .from('mock_exam_sets')
      .select('id, year, session_number, title, description, total_questions, created_at')
      .eq('id', id)
      .single()

    if (examError || !examData) {
      return Response.json({ error: 'Mock exam not found' }, { status: 404 })
    }

    // 모의고사에 포함된 문제들을 과목별로 그룹화
    const { data: mockQuestions, error: questionsError } = await supabase
      .from('mock_exam_questions')
      .select(
        `
        id,
        question_id,
        sort_order,
        questions(
          id,
          subject_id,
          difficulty,
          question_text,
          option_1,
          option_2,
          option_3,
          option_4,
          correct_answer,
          explanation,
          source_year,
          source_type,
          is_approved,
          created_at,
          updated_at,
          subjects(id, code, name_ko, color_hex, sort_order)
        )
      `
      )
      .eq('mock_exam_set_id', id)
      .order('sort_order', { ascending: true })

    if (questionsError) {
      return Response.json({ error: questionsError.message }, { status: 500 })
    }

    // 과목별로 그룹화
    const subjectMap = new Map<
      number,
      Subject & { questions: Question[] }
    >()

    mockQuestions?.forEach((mq: any) => {
      const question = mq.questions
      if (!question) return

      const subject = question.subjects
      if (!subject) return

      const subjectId = subject.id
      if (!subjectMap.has(subjectId)) {
        subjectMap.set(subjectId, {
          ...subject,
          questions: [],
        })
      }

      subjectMap.get(subjectId)!.questions.push({
        id: question.id,
        subject_id: question.subject_id,
        difficulty: question.difficulty,
        question_text: question.question_text,
        option_1: question.option_1,
        option_2: question.option_2,
        option_3: question.option_3,
        option_4: question.option_4,
        correct_answer: question.correct_answer,
        explanation: question.explanation,
        source_year: question.source_year,
        source_type: question.source_type,
        is_approved: question.is_approved,
        created_at: question.created_at,
        updated_at: question.updated_at,
      })
    })

    // 과목순으로 정렬
    const subjects = Array.from(subjectMap.values()).sort(
      (a, b) => a.sort_order - b.sort_order
    )

    const result: MockExamDetail = {
      ...examData,
      subjects,
    }

    return Response.json(result, { status: 200 })
  } catch (error) {
    console.error('Unexpected error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
