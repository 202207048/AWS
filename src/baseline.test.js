import { describe, expect, it } from 'vitest'
import { STATIONS } from './stations.js'
import { baselineStation } from './baseline.js'
import { rankStations, straightLineDistance } from './ranking.js'

const station = (name) => STATIONS.find((item) => item.name === name)
const participantsAt = (...names) => names.map((name, index) => ({ id: index + 1, station: station(name) }))

describe('기존 방식 (좌표 평균점에서 가장 가까운 역)', () => {
  it('참여자나 후보역이 없으면 null', () => {
    expect(baselineStation([], STATIONS)).toBeNull()
    expect(baselineStation(participantsAt('강남'), [])).toBeNull()
  })

  it('평균점에서 직선거리가 가장 가까운 역을 고른다', () => {
    const participants = participantsAt('강남', '건대입구', '잠실', '수원')
    const center = {
      lat: participants.reduce((total, { station: s }) => total + s.lat, 0) / participants.length,
      lng: participants.reduce((total, { station: s }) => total + s.lng, 0) / participants.length,
    }
    const nearestDistance = Math.min(...STATIONS.map((candidate) => straightLineDistance(center, candidate)))
    const result = baselineStation(participants, STATIONS)

    expect(straightLineDistance(center, result.station)).toBe(nearestDistance)
  })

  it('rankStations 결과와 같은 StationResult 형식을 돌려준다', () => {
    const participants = participantsAt('강남', '건대입구', '잠실', '수원')
    const result = baselineStation(participants, STATIONS)
    const sameStation = rankStations(participants, STATIONS).find(
      (ranked) => ranked.station.name === result.station.name,
    )

    expect(result).toEqual(sameStation)
    expect(result.times).toHaveLength(4)
    expect(result.times[0]).toEqual({ participantId: 1, minutes: 0, transfers: 0 })
    expect(result.weightedScore).toBeCloseTo(result.maxTime * 0.7 + result.spread * 0.3)
    expect(result.totalTransfers).toBe(0)
  })

  it('강남·건대입구·잠실·수원: 기존 방식은 강남, 판결(fair 1위)은 판교로 다르다', () => {
    const participants = participantsAt('강남', '건대입구', '잠실', '수원')
    const baseline = baselineStation(participants, STATIONS)
    const fairWinner = rankStations(participants, STATIONS)[0]

    expect(baseline.station.name).toBe('강남')
    expect(fairWinner.station.name).toBe('판교')
    expect(fairWinner.maxTime).toBeLessThan(baseline.maxTime)
  })

  it('건대입구·잠실·노원·인천: 기존 방식은 서울역', () => {
    const participants = participantsAt('건대입구', '잠실', '노원', '인천')

    expect(baselineStation(participants, STATIONS).station.name).toBe('서울역')
  })
})
