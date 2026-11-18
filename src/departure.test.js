import { describe, expect, it } from 'vitest'
import { departureTime, formatClock, parseClock } from './departure.js'

describe('departureTime', () => {
  it('약속 시각 − 반올림한 이동시간 − 5분', () => {
    expect(departureTime('19:00', 47.6)).toBe('18:07')
    expect(departureTime('19:00', 0)).toBe('18:55')
  })

  it('자정을 넘기면 전날 시각으로 감는다', () => {
    expect(departureTime('00:20', 30)).toBe('23:45')
  })

  it('잘못된 입력이면 null', () => {
    expect(departureTime('', 30)).toBeNull()
    expect(departureTime('25:00', 30)).toBeNull()
    expect(departureTime('19:00', Number.NaN)).toBeNull()
  })
})

describe('parseClock / formatClock', () => {
  it('HH:MM을 분으로, 분을 HH:MM으로 바꾼다', () => {
    expect(parseClock('07:05')).toBe(425)
    expect(formatClock(425)).toBe('07:05')
    expect(formatClock(-15)).toBe('23:45')
  })
})
