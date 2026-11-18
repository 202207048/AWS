import { describe, expect, it } from 'vitest'
import { STATIONS } from './stations.js'
import { estimateTravelMinutes, rankStations, straightLineDistance } from './ranking.js'

const station = (name) => STATIONS.find((item) => item.name === name)

describe('이동시간 계산', () => {
  it('같은 역은 기본 이동시간 10분이다', () => {
    expect(estimateTravelMinutes(station('강남'), station('강남'))).toBeCloseTo(10)
  })

  it('직선거리 × 2.5분 + 10분 공식을 적용한다', () => {
    const distance = straightLineDistance(station('강남'), station('잠실'))
    expect(estimateTravelMinutes(station('강남'), station('잠실'))).toBeCloseTo(distance * 2.5 + 10)
  })
})

describe('후보역 순위', () => {
  it('30개 역을 점수가 낮은 순서로 정렬한다', () => {
    const participants = [
      { id: 1, station: station('강남') },
      { id: 2, station: station('홍대입구') },
      { id: 3, station: station('잠실') },
    ]
    const results = rankStations(participants, STATIONS)

    expect(results).toHaveLength(30)
    expect(results[0].times).toHaveLength(3)
    expect(results.every((result, index) => index === 0 || results[index - 1].score <= result.score)).toBe(true)

    for (const result of results) {
      expect(result.score).toBeCloseTo(result.maxTime * 0.7 + result.spread * 0.3)
    }
  })
})
