import { describe, expect, it } from 'vitest'
import { createTemplateVerdict, stationLabel } from './verdict.js'

const result = {
  station: { name: '서울역', lat: 37.5547, lng: 126.9706 },
  times: [
    { participantId: 1, minutes: 38.4, transfers: 0 },
    { participantId: 2, minutes: 30.8, transfers: 0 },
  ],
  maxTime: 38.4,
  minTime: 30.8,
  spread: 7.6,
  totalTransfers: 0,
  weightedScore: 29.16,
}

describe('stationLabel', () => {
  it('역 이름에 "역"을 한 번만 붙인다', () => {
    expect(stationLabel('사당')).toBe('사당역')
    expect(stationLabel('서울역')).toBe('서울역')
    expect(stationLabel('분당(서현)')).toBe('분당(서현)역')
  })
})

describe('템플릿 판결문', () => {
  it('API와 같은 주문, 판결 이유, 선고 구조를 반환한다', () => {
    expect(createTemplateVerdict(result, '밥')).toEqual({
      order: '이번 밥 약속 장소는 서울역으로 정한다.',
      reason: '누구도 약 38분을 넘기지 않고, 이동시간 차이도 약 8분에 그친다. 한 사람의 희생으로 세운 약속은 오래가지 못한다는 점도 참작했다.',
      sentence: '전원은 이 판결에 따라 서울역으로 모일 것.',
    })
  })

  it('"역"으로 끝나지 않는 역 이름에는 "역"을 붙인다', () => {
    const verdict = createTemplateVerdict({ ...result, station: { name: '사당', lat: 37.4765, lng: 126.9816 } }, '카페')
    expect(verdict.order).toBe('이번 카페 약속 장소는 사당역으로 정한다.')
    expect(verdict.sentence).toBe('전원은 이 판결에 따라 사당역으로 모일 것.')
  })
})
