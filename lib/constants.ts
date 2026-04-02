/** 자동 일정: 날짜별로 각 과목마다 채울 승인된 문제 개수 */
export const AUTO_SCHEDULE_QUESTIONS_PER_SUBJECT = 10

export const SUBJECTS = [
  { id: 1, code: 'korean',  nameKo: '국어',   color: '#ef4444' },
  { id: 2, code: 'math',    nameKo: '수학',   color: '#3b82f6' },
  { id: 3, code: 'english', nameKo: '영어',   color: '#10b981' },
  { id: 4, code: 'social',  nameKo: '사회',   color: '#f59e0b' },
  { id: 5, code: 'science', nameKo: '과학',   color: '#8b5cf6' },
  { id: 6, code: 'ethics',  nameKo: '도덕',   color: '#ec4899' },
  { id: 7, code: 'history', nameKo: '역사',   color: '#14b8a6' },
] as const

export const DIFFICULTY_LABELS: Record<number, string> = {
  1: '쉬움',
  2: '보통',
  3: '어려움',
}

export const DIFFICULTY_COLORS: Record<number, string> = {
  1: '#10b981',
  2: '#f59e0b',
  3: '#ef4444',
}

/** 일일 자동 생성: 과목 전체를 한 번에 (Cron 실행 시간 단축) */
export function buildDailyPackPrompt(difficultyLabel: string, perSubject: number): string {
  const names = SUBJECTS.map((s) => s.nameKo)
  const keysJson = JSON.stringify(names)
  return `당신은 한국 중학교 검정고시 문제를 만드는 전문가입니다.
아래 과목 각각에 대해 **정확히 ${perSubject}개씩** ${difficultyLabel} 난이도의 4지선다 문제를 만드세요.

과목 목록(순서 무관, 키는 아래 한글 이름과 **완전히 동일**해야 함): ${names.join(', ')}

출제 기준:
- 검정고시·EBS·공식 교재에서 자주 나오는 유형·개념을 참고한 **유사** 문항 (특정 교재 문장 그대로 복사 금지)
- 사실·용어·계산이 틀리지 않게 검토
- 난이도는 ${difficultyLabel}, 함정·과도한 난이도 지양
- 보기 4개는 서로 달라야 하고 정답은 1개

반드시 아래 JSON만 출력:
{
  "questions_by_subject": {
    "국어": [ { "question_text": "", "option_1": "", "option_2": "", "option_3": "", "option_4": "", "correct_answer": 1, "explanation": "" } ],
    "...": []
  }
}

questions_by_subject의 키는 반드시 다음 배열과 동일한 문자열이어야 합니다: ${keysJson}
각 배열 길이는 정확히 ${perSubject}개.`
}

export function buildAIPrompt(subjectNameKo: string, difficultyLabel: string, count: number): string {
  return `당신은 한국 중학교 검정고시 문제를 만드는 전문가입니다.
${subjectNameKo} 과목의 ${difficultyLabel} 난이도 문제 ${count}개를 만들어주세요.

출제 기준:
- 실제 검정고시/EBS/공식 교재에서 자주 나오는 개념과 문항 유형을 참고한 유사 스타일로 작성
- 특정 교재 문장을 그대로 복사하지 말고, 핵심 개념 중심으로 새롭게 재구성
- 사실관계(연도, 용어, 개념 정의, 계산 결과)가 틀리지 않도록 자체 검토 후 제출
- 난이도는 ${difficultyLabel} 기준으로, 지나치게 복잡한 함정 문제는 피하고 학습용으로 명확하게 작성
- 각 문제는 4개의 선택지를 가지며 정답은 하나만 존재

출력 전 자체 점검:
1) 문제/보기/정답 번호가 모두 완전한가?
2) 오답 3개는 그럴듯하지만 명확히 오답인가?
3) 해설이 정답 근거를 분명히 설명하는가?

반드시 아래 JSON 형식으로만 응답하세요 (다른 텍스트 없이):
{
  "questions": [
    {
      "question_text": "문제 내용",
      "option_1": "첫 번째 보기",
      "option_2": "두 번째 보기",
      "option_3": "세 번째 보기",
      "option_4": "네 번째 보기",
      "correct_answer": 2,
      "explanation": "정답 해설 (왜 이 답이 맞는지 상세 설명)"
    }
  ]
}`
}
