# 검정고시 앱 설정 가이드

## 1단계: Supabase 설정

1. [supabase.com](https://supabase.com) 에서 새 프로젝트 생성
2. SQL Editor에서 `database-setup.sql` 파일 내용 전체 실행
3. 프로젝트 설정 > API에서 다음 값 복사:
   - `URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role secret` → `SUPABASE_SERVICE_ROLE_KEY`

## 2단계: OpenAI API 키

1. [platform.openai.com](https://platform.openai.com) 에서 API 키 생성
2. `OPENAI_API_KEY`에 사용

## 3단계: 로컬 개발

```bash
# .env.local 파일 생성
cp .env.local.example .env.local

# .env.local 파일을 편집해서 실제 값 입력
```

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
OPENAI_API_KEY=sk-...
ADMIN_PASSWORD=아빠가원하는비밀번호
STUDENT_PASSWORD=딸이기억하기쉬운비밀번호
AUTH_SECRET=최소32자이상의랜덤문자열예시abcdefghijklmnop12345678
NEXT_PUBLIC_APP_URL=http://localhost:3000
CRON_SECRET=openssl_rand_hex_32_등으로_만든_긴_비밀값
```

```bash
npm run dev
# http://localhost:3000 접속
```

## 4단계: Vercel 배포

```bash
npm install -g vercel
vercel
```

또는 GitHub에 push 후 [vercel.com](https://vercel.com) 에서 import.

**Vercel 환경 변수 설정:**
- Vercel 대시보드 > 프로젝트 > Settings > Environment Variables
- 위의 모든 환경 변수 입력 (NEXT_PUBLIC_APP_URL은 실제 Vercel URL로)
- **`CRON_SECRET`** 을 꼭 넣어야 합니다. Vercel이 Cron 호출 시 `Authorization: Bearer <CRON_SECRET>` 으로 보냅니다.

## 5단계: 매일 자동 문제 생성 (Vercel Cron)

- 프로젝트 루트의 `vercel.json` 에 Cron이 정의되어 있습니다: **매일 23:00 UTC** (서울에서는 **매일 오전 8시**). 실행 시점의 **한국(서울) 날짜**로 그날 일정을 채웁니다(앱의 「오늘」과 같은 날짜).
- 동작: 그 날짜에 쓸 문제 묶음을 OpenAI에 **한 번에** 요청한 뒤(과목 7×10문항), 기존 일정 행을 지우고 DB에 저장 → **자동 승인** 후 `daily_schedules`에 연결합니다. (예전처럼 과목별 7번 호출보다 Vercel 실행 시간 안에 끝날 가능성이 큽니다.)
- **실행 시간:** 과목당 API 호출이 있어 1~3분 걸릴 수 있습니다. Vercel **Hobby** 플랜은 함수 시간 제한이 짧아 실패할 수 있으니, 필요하면 **Pro** 등으로 늘리거나 [Cron 문서](https://vercel.com/docs/cron-jobs)를 확인하세요. (`app/api/cron/daily-questions/route.ts`의 `maxDuration` 참고)
- 배포 후 Vercel 대시보드 **Cron Jobs** 에서 등록 여부를 확인하세요.
- 로컬에서 수동 실행 예시:
  `curl -H "Authorization: Bearer $CRON_SECRET" "https://배포주소/api/cron/daily-questions"`
- **오늘 배정이 비어 있을 때:** 관리자 로그인 → **대시보드** → `오늘 문제 지금 자동 생성 (Cron과 동일)` 버튼으로 같은 작업을 수동 실행할 수 있습니다. (Cron이 실패했거나 아직 안 돌았을 때)

### (선택) 관리자 대시보드에서 Vercel 배포(업) 버튼

로그인 **첫 화면**에 배포 버튼을 두면 누구나 누를 수 있어 위험하므로, **아빠(관리자) 대시보드**에만 `Vercel 프로덕션 배포 (업) 실행` 버튼을 두었습니다.

1. [Vercel](https://vercel.com) → 해당 프로젝트 → **Settings** → **Git** → **Deploy Hooks**
2. 이름 예: `admin-button`, Branch: `main`(또는 배포 브랜치) → **Create Hook**
3. 생성된 URL을 프로젝트 환경 변수 **`VERCEL_DEPLOY_HOOK_URL`** 에 저장 (로컬은 `.env.local`)
4. 관리자로 로그인 → **대시보드**에서 버튼 클릭 → Vercel이 새 배포를 시작합니다.

## 앱 사용법

### 아빠 (관리자)
1. `/login` 접속
2. "아빠 (관리자)" 선택 → 비밀번호 입력
3. **매일 오전** Vercel Cron이 돌면 오늘 일정이 채워집니다. 비어 있으면 대시보드에서 **오늘 문제 지금 자동 생성**을 누르거나, `AI 문제 생성`·`일정 관리`로 보충할 수 있습니다.
4. 딸의 성적 확인: `성적 분석` 메뉴

### 딸 (학생)
1. iPad Safari에서 앱 URL 접속
2. "딸 (학생)" 선택 → 비밀번호 입력
3. 오늘의 문제 확인 후 "공부 시작!" 버튼
4. 4지선다 문제 풀기 → 즉시 정오 피드백
5. 결과 화면에서 틀린 문제 복습

## 파일 구조

```
app/
  login/          # 로그인 페이지
  admin/          # 관리자 페이지 (아빠 Mac용)
    dashboard/    # 대시보드
    questions/    # 문제 은행 관리
    generate/     # AI 문제 생성
    schedule/     # 날짜별 문제 배정
    analytics/    # 성적 분석
  student/        # 학생 페이지 (딸 iPad용)
    today/        # 오늘의 학습
    study/        # 문제 풀기 (세션)
    results/      # 결과 보기
    history/      # 학습 기록
  api/            # API 라우트

lib/
  supabase.ts         # Supabase 브라우저 클라이언트
  supabase-server.ts  # Supabase 서버 클라이언트 (서비스 키)
  openai.ts           # OpenAI API 연동
  korea-date.ts       # 한국 날짜(Asia/Seoul)
  daily-ai-generation.ts  # Cron용 일괄 생성
  auth.ts             # 인증 (JWT 쿠키)
  constants.ts        # 과목, 난이도, AI 프롬프트

database-setup.sql    # Supabase 스키마 (이걸 실행하세요)
```
