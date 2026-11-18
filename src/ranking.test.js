import { describe, expect, it } from 'vitest'
import { STATIONS } from './stations.js'
import {
  estimateTravelMinutes,
  rankStations,
  roundedMinutes,
  straightLineDistance,
  travelTime,
} from './ranking.js'

const station = (name) => STATIONS.find((item) => item.name === name)
const participantsAt = (...names) => names.map((name, index) => ({ id: index + 1, station: station(name) }))

const fairKey = (result) => [roundedMinutes(result.maxTime), roundedMinutes(result.spread)]
const weightedKey = (result) => [Math.round(result.weightedScore * 10), roundedMinutes(result.maxTime)]

function compareKeys(a, b) {
  for (let index = 0; index < a.length; index += 1) {
    if (a[index] !== b[index]) return a[index] - b[index]
  }
  return 0
}

function expectSortedBy(results, keyOf) {
  for (let index = 1; index < results.length; index += 1) {
    const previous = results[index - 1]
    const current = results[index]
    const order = compareKeys(keyOf(previous), keyOf(current))
    expect(order).toBeLessThanOrEqual(0)
    if (order === 0) {
      expect(previous.station.name.localeCompare(current.station.name, 'ko')).toBeLessThan(0)
    }
  }
}

describe('이동시간 계산', () => {
  it('같은 역이면 0분, 환승 0회다', () => {
    expect(travelTime('강남', '강남')).toEqual({ minutes: 0, transfers: 0 })
  })

  it('직선거리 × 2.5분 + 10분 공식을 적용한다', () => {
    const distance = straightLineDistance(station('강남'), station('잠실'))
    expect(estimateTravelMinutes(station('강남'), station('잠실'))).toBeCloseTo(distance * 2.5 + 10)
    expect(travelTime('강남', '잠실')).toEqual({ minutes: distance * 2.5 + 10, transfers: 0 })
  })
})

describe('후보역 순위', () => {
  const participants = participantsAt('강남', '홍대입구', '잠실')

  it('인자 두 개로 부르면 fair 모드로 정렬한다', () => {
    const twoArgs = rankStations(participants, STATIONS)
    const fair = rankStations(participants, STATIONS, { mode: 'fair' })

    expect(twoArgs).toHaveLength(30)
    expect(twoArgs[0].times).toHaveLength(3)
    expect(twoArgs.map((result) => result.station.name)).toEqual(fair.map((result) => result.station.name))
  })

  it('모든 결과에 weightedScore = 최대×0.7 + 편차×0.3과 환승 정보를 넣는다', () => {
    for (const mode of ['fair', 'weighted']) {
      for (const result of rankStations(participants, STATIONS, { mode })) {
        expect(result.spread).toBeCloseTo(result.maxTime - result.minTime)
        expect(result.weightedScore).toBeCloseTo(result.maxTime * 0.7 + result.spread * 0.3)
        expect(result.totalTransfers).toBe(0)
        expect(result.times.every((time) => time.transfers === 0)).toBe(true)
      }
    }
  })

  it('fair 모드는 반올림한 최대 시간 → 반올림한 편차 → 역 이름 순서로 정렬한다', () => {
    for (const names of [['강남', '홍대입구', '잠실'], ['강남', '건대입구', '잠실', '수원'], ['강남', '사당']]) {
      expectSortedBy(rankStations(participantsAt(...names), STATIONS), fairKey)
    }
  })

  it('fair 모드는 최대 시간이 반올림해서 같으면 편차가 작은 역을 앞에 둔다', () => {
    // 교대(최대 약 18.6분, 편차 약 5.3분)와 고속터미널(최대 약 19.4분, 편차 약 4.0분)은 둘 다 최대 19분
    const results = rankStations(participantsAt('강남', '사당'), STATIONS)
    const names = results.map((result) => result.station.name)

    expect(names.indexOf('고속터미널')).toBeLessThan(names.indexOf('교대'))
  })

  it('weighted 모드는 가중 점수(0.1점 단위) → 반올림한 최대 시간 → 역 이름 순서로 정렬한다', () => {
    for (const names of [['강남', '홍대입구', '잠실'], ['건대입구', '잠실', '노원', '인천']]) {
      expectSortedBy(rankStations(participantsAt(...names), STATIONS, { mode: 'weighted' }), weightedKey)
    }
  })

  it('두 모드의 1위가 다를 수 있다 (건대입구·잠실·노원·인천)', () => {
    const participants4 = participantsAt('건대입구', '잠실', '노원', '인천')

    expect(rankStations(participants4, STATIONS)[0].station.name).toBe('신도림')
    expect(rankStations(participants4, STATIONS, { mode: 'weighted' })[0].station.name).toBe('마곡나루')
  })

  it('지원하지 않는 모드는 오류를 던진다', () => {
    expect(() => rankStations(participants, STATIONS, { mode: 'cheap' })).toThrow()
  })
})
