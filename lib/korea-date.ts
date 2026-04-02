export const KOREA_TIME_ZONE = 'Asia/Seoul'

const koreaDateFmt = { timeZone: KOREA_TIME_ZONE } as const

/** 한국(Asia/Seoul) 기준 캘린더 날짜 YYYY-MM-DD */
export function getKoreaDateString(d: Date = new Date()): string {
  return d.toLocaleDateString('en-CA', koreaDateFmt)
}

/** 한국 날짜 문자열에서 하루 전 (연속 학습·스트릭 계산용) */
export function previousKoreaDate(ymd: string): string {
  const t = new Date(`${ymd}T12:00:00+09:00`)
  t.setTime(t.getTime() - 86400000)
  return t.toLocaleDateString('en-CA', koreaDateFmt)
}

/** 한국 시각 기준 연·월(0~11)·일 (UI 달력·초기 뷰용) */
export function getKoreaCalendarParts(d: Date = new Date()): {
  year: number
  monthIndex0: number
  day: number
} {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    ...koreaDateFmt,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  })
  const parts = fmt.formatToParts(d)
  const y = Number(parts.find((p) => p.type === 'year')?.value)
  const m = Number(parts.find((p) => p.type === 'month')?.value)
  const day = Number(parts.find((p) => p.type === 'day')?.value)
  return { year: y, monthIndex0: m - 1, day }
}

/** 그레고리력 월의 일 수 (윤년·월 길이만 반영, 타임존 무관) */
export function getDaysInGregorianMonth(year: number, monthIndex0: number): number {
  return new Date(year, monthIndex0 + 1, 0).getDate()
}

/**
 * 해당 인스턴트가 한국 달력에서 갖는 요일. 0=일 … 6=토
 */
export function getKoreaDayOfWeek(d: Date): number {
  const short = new Intl.DateTimeFormat('en-US', {
    timeZone: KOREA_TIME_ZONE,
    weekday: 'short',
  }).format(d)
  const sun0 = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(short)
  if (sun0 >= 0) return sun0
  const long = new Intl.DateTimeFormat('en-US', {
    timeZone: KOREA_TIME_ZONE,
    weekday: 'long',
  }).format(d)
  const sun0long = [
    'Sunday',
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
  ].indexOf(long)
  return sun0long >= 0 ? sun0long : 0
}

/** YYYY-MM-DD(한국 그날)의 요일 0=일 … 6=토 */
export function getKoreaWeekdayForYmd(ymd: string): number {
  return getKoreaDayOfWeek(new Date(`${ymd}T12:00:00+09:00`))
}

/** 대시보드·오늘 학습 상단 등: 한국 기준 긴 날짜 문자열 */
export function formatKoreaDateLong(d: Date = new Date()): string {
  return d.toLocaleDateString('ko-KR', {
    timeZone: KOREA_TIME_ZONE,
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  })
}

/** 학습 기록 목록 등: YYYY-MM-DD 저장값 → 한국 기준 월·일·요일 */
export function formatKoreaDateLabelFromYmd(ymd: string): string {
  const anchor = new Date(`${ymd}T12:00:00+09:00`)
  return anchor.toLocaleDateString('ko-KR', {
    timeZone: KOREA_TIME_ZONE,
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  })
}
