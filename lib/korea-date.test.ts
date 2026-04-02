import { describe, expect, it } from 'vitest'
import {
  getKoreaDateString,
  previousKoreaDate,
  getKoreaCalendarParts,
  getDaysInGregorianMonth,
  getKoreaWeekdayForYmd,
} from '@/lib/korea-date'

describe('korea-date', () => {
  it('getKoreaDateString: 서울 자정 직전 타임스탬프는 전날 날짜', () => {
    expect(getKoreaDateString(new Date('2025-06-15T14:59:59+09:00'))).toBe('2025-06-15')
  })

  it('previousKoreaDate: 하루 전 문자열', () => {
    expect(previousKoreaDate('2025-06-02')).toBe('2025-06-01')
    expect(previousKoreaDate('2025-03-01')).toBe('2025-02-28')
  })

  it('getKoreaCalendarParts: 한국 날짜 구성요소', () => {
    const p = getKoreaCalendarParts(new Date('2025-06-15T14:59:59+09:00'))
    expect(p.year).toBe(2025)
    expect(p.monthIndex0).toBe(5)
    expect(p.day).toBe(15)
  })

  it('getDaysInGregorianMonth: 2025년 2월은 28일', () => {
    expect(getDaysInGregorianMonth(2025, 1)).toBe(28)
  })

  it('getKoreaWeekdayForYmd: 2025-03-01은 토요일(6)', () => {
    expect(getKoreaWeekdayForYmd('2025-03-01')).toBe(6)
  })
})
