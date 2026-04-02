-- ============================================================
-- 검정고시 앱 - Supabase 스키마
-- Supabase SQL Editor에서 실행하세요
-- ============================================================

-- 1. 과목 목록
CREATE TABLE subjects (
  id        SERIAL PRIMARY KEY,
  code      TEXT NOT NULL UNIQUE,
  name_ko   TEXT NOT NULL,
  color_hex TEXT NOT NULL DEFAULT '#6366f1',
  sort_order INTEGER NOT NULL DEFAULT 0
);

INSERT INTO subjects (code, name_ko, color_hex, sort_order) VALUES
  ('korean',  '국어',   '#ef4444', 1),
  ('math',    '수학',   '#3b82f6', 2),
  ('english', '영어',   '#10b981', 3),
  ('social',  '사회',   '#f59e0b', 4),
  ('science', '과학',   '#8b5cf6', 5),
  ('ethics',  '도덕',   '#ec4899', 6),
  ('history', '역사',   '#14b8a6', 7);


-- 2. 문제 은행
CREATE TABLE questions (
  id             UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  subject_id     INTEGER NOT NULL REFERENCES subjects(id),
  difficulty     SMALLINT NOT NULL CHECK (difficulty BETWEEN 1 AND 3),
  question_text  TEXT NOT NULL,
  option_1       TEXT NOT NULL,
  option_2       TEXT NOT NULL,
  option_3       TEXT NOT NULL,
  option_4       TEXT NOT NULL,
  correct_answer SMALLINT NOT NULL CHECK (correct_answer BETWEEN 1 AND 4),
  explanation    TEXT,
  source_year    SMALLINT,
  source_type    TEXT DEFAULT 'ai' CHECK (source_type IN ('ai', 'manual', 'official')),
  is_approved    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_questions_subject    ON questions(subject_id);
CREATE INDEX idx_questions_difficulty ON questions(difficulty);
CREATE INDEX idx_questions_approved   ON questions(is_approved);


-- 3. 날짜별 문제 배정
CREATE TABLE daily_schedules (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  schedule_date DATE NOT NULL,
  question_id   UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  sort_order    INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(schedule_date, question_id)
);

CREATE INDEX idx_daily_schedules_date     ON daily_schedules(schedule_date);
CREATE INDEX idx_daily_schedules_question ON daily_schedules(question_id);


-- 4. 학습 세션
CREATE TABLE study_sessions (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_date     DATE NOT NULL DEFAULT CURRENT_DATE,
  started_at       TIMESTAMPTZ DEFAULT NOW(),
  completed_at     TIMESTAMPTZ,
  total_questions  INTEGER NOT NULL DEFAULT 0,
  correct_count    INTEGER NOT NULL DEFAULT 0,
  score_pct        NUMERIC(5,2),
  duration_seconds INTEGER,
  is_completed     BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX idx_sessions_date ON study_sessions(session_date);


-- 5. 개별 답변 기록
CREATE TABLE user_answers (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id      UUID NOT NULL REFERENCES study_sessions(id) ON DELETE CASCADE,
  question_id     UUID NOT NULL REFERENCES questions(id),
  selected_answer SMALLINT NOT NULL CHECK (selected_answer BETWEEN 1 AND 4),
  is_correct      BOOLEAN NOT NULL,
  time_taken_ms   INTEGER,
  answered_at     TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(session_id, question_id)
);

CREATE INDEX idx_answers_session  ON user_answers(session_id);
CREATE INDEX idx_answers_question ON user_answers(question_id);
CREATE INDEX idx_answers_correct  ON user_answers(is_correct);


-- 자동 updated_at 트리거
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_questions_updated_at
  BEFORE UPDATE ON questions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ============================================================
-- Row Level Security
-- ============================================================
ALTER TABLE subjects         ENABLE ROW LEVEL SECURITY;
ALTER TABLE questions        ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_schedules  ENABLE ROW LEVEL SECURITY;
ALTER TABLE study_sessions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_answers     ENABLE ROW LEVEL SECURITY;

-- 읽기: anon key 허용 (앱 레벨에서 접근 제어)
CREATE POLICY "anon_read_subjects"        ON subjects        FOR SELECT USING (true);
CREATE POLICY "anon_read_questions"       ON questions       FOR SELECT USING (true);
CREATE POLICY "anon_read_daily_schedules" ON daily_schedules FOR SELECT USING (true);
CREATE POLICY "anon_read_sessions"        ON study_sessions  FOR SELECT USING (true);
CREATE POLICY "anon_read_answers"         ON user_answers    FOR SELECT USING (true);

-- 쓰기: service role key만 허용 (API 라우트에서만 사용)
-- (service role은 RLS를 우회하므로 추가 정책 불필요)


-- ============================================================
-- 분석용 뷰
-- ============================================================

-- 과목별 정답률
CREATE VIEW subject_stats AS
SELECT
  s.id           AS subject_id,
  s.name_ko      AS subject_name,
  s.color_hex,
  COUNT(ua.id)   AS total_answered,
  SUM(CASE WHEN ua.is_correct THEN 1 ELSE 0 END) AS correct_count,
  ROUND(
    100.0 * SUM(CASE WHEN ua.is_correct THEN 1 ELSE 0 END) / NULLIF(COUNT(ua.id), 0),
    1
  )              AS correct_pct
FROM subjects s
LEFT JOIN questions q    ON q.subject_id = s.id
LEFT JOIN user_answers ua ON ua.question_id = q.id
GROUP BY s.id, s.name_ko, s.color_hex;


-- 일별 정답률 추이
CREATE VIEW daily_score_trend AS
SELECT
  session_date,
  COUNT(id)            AS session_count,
  SUM(total_questions) AS questions_answered,
  SUM(correct_count)   AS total_correct,
  ROUND(
    100.0 * SUM(correct_count) / NULLIF(SUM(total_questions), 0),
    1
  )                    AS daily_correct_pct
FROM study_sessions
WHERE is_completed = TRUE
GROUP BY session_date
ORDER BY session_date;
