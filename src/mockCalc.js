// 개발2의 src/ranking.js + src/baseline.js가 합쳐지기 전까지 쓰는 가짜 계산 모듈.
// PLAN.md 5-1 형식을 그대로 따르므로, 나중에 App.jsx의 import만 바꾸면 된다.
import { STATIONS } from './stations.js'

const EARTH_RADIUS_KM = 6371
const stationByName = new Map(STATIONS.map((station) => [station.name, station]))

function toRadians(degrees) {
  return (degrees * Math.PI) / 180
}

export function straightLineDistance(from, to) {
  const latDelta = toRadians(to.lat - from.lat)
  const lngDelta = toRadians(to.lng - from.lng)
  const fromLat = toRadians(from.lat)
  const toLat = toRadians(to.lat)
  const a =
    Math.sin(latDelta / 2) ** 2 +
    Math.cos(fromLat) * Math.cos(toLat) * Math.sin(lngDelta / 2) ** 2

  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export function roundedMinutes(minutes) {
  return Math.round(minutes)
}

function stationResult(participants, station) {
  const times = participants.map((participant) => {
    const estimate = travelTime(participant.station.name, station.name)
    return { participantId: participant.id, ...estimate }
  })
  const minuteValues = times.map(({ minutes }) => minutes)
  const maxTime = Math.max(...minuteValues)
  const minTime = Math.min(...minuteValues)
  const spread = maxTime - minTime

  return {
    station,
    times,
    maxTime,
    minTime,
    spread,
    totalTransfers: times.reduce((sum, { transfers }) => sum + transfers, 0),
    weightedScore: maxTime * 0.7 + spread * 0.3,
  }
}

const byName = (a, b) => a.station.name.localeCompare(b.station.name, 'ko')

const compareFair = (a, b) =>
  roundedMinutes(a.maxTime) - roundedMinutes(b.maxTime) ||
  roundedMinutes(a.spread) - roundedMinutes(b.spread) ||
  byName(a, b)

const compareWeighted = (a, b) =>
  a.weightedScore - b.weightedScore ||
  roundedMinutes(a.maxTime) - roundedMinutes(b.maxTime) ||
  byName(a, b)

export function travelTime(fromName, toName) {
  if (fromName === toName) return { minutes: 0, transfers: 0 }

  const from = stationByName.get(fromName)
  const to = stationByName.get(toName)
  if (!from || !to) throw new Error('30개 후보역에 포함된 역 이름이 필요합니다.')

  return {
    minutes: straightLineDistance(from, to) * 2.5 + 10,
    transfers: 0,
  }
}

// mode: 'fair'(기본) = 최대 시간 → 편차 → 이름, 'weighted' = 가중 점수 → 최대 시간 → 이름
export function rankStations(participants, stations, { mode = 'fair' } = {}) {
  if (!participants?.length || !stations?.length) return []

  return stations
    .map((station) => stationResult(participants, station))
    .sort(mode === 'weighted' ? compareWeighted : compareFair)
}

export function baselineStation(participants, stations) {
  if (!participants?.length || !stations?.length) return null

  const center = participants.reduce(
    (average, participant) => ({
      lat: average.lat + participant.station.lat / participants.length,
      lng: average.lng + participant.station.lng / participants.length,
    }),
    { lat: 0, lng: 0 },
  )
  const nearestStation = stations.reduce((nearest, station) =>
    straightLineDistance(center, station) < straightLineDistance(center, nearest)
      ? station
      : nearest,
  )

  return stationResult(participants, nearestStation)
}
