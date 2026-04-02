export type Role = 'admin' | 'student'

export type Subject = {
  id: number
  code: string
  name_ko: string
  color_hex: string
  sort_order: number
}

export type Difficulty = 1 | 2 | 3

export type CorrectAnswer = 1 | 2 | 3 | 4

export type Question = {
  id: string
  subject_id: number
  subject?: Subject
  difficulty: Difficulty
  question_text: string
  option_1: string
  option_2: string
  option_3: string
  option_4: string
  correct_answer: CorrectAnswer
  explanation: string | null
  source_year: number | null
  source_type: 'ai' | 'manual' | 'official'
  is_approved: boolean
  created_at: string
  updated_at: string
}

export type GeneratedQuestion = {
  question_text: string
  option_1: string
  option_2: string
  option_3: string
  option_4: string
  correct_answer: CorrectAnswer
  explanation: string
}

export type DailySchedule = {
  id: string
  schedule_date: string
  question_id: string
  question?: Question
  sort_order: number
}

export type StudySession = {
  id: string
  session_date: string
  started_at: string
  completed_at: string | null
  total_questions: number
  correct_count: number
  score_pct: number | null
  duration_seconds: number | null
  is_completed: boolean
}

export type UserAnswer = {
  id: string
  session_id: string
  question_id: string
  question?: Question
  selected_answer: CorrectAnswer
  is_correct: boolean
  time_taken_ms: number | null
  answered_at: string
}

export type SubjectStat = {
  subject_id: number
  subject_name: string
  color_hex: string
  total_answered: number
  correct_count: number
  correct_pct: number
}

export type DailyScoreTrend = {
  session_date: string
  questions_answered: number
  total_correct: number
  daily_correct_pct: number
}
