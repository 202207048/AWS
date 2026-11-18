import { STATIONS } from './stations.js'

const EARTH_RADIUS_KM = 6371
const VALID_MODES = new Set(['fair', 'weighted'])
const stationByName = new Map(STATIONS.map((station) => [station.name, station]))

function toRadians(degrees) {
  return (degrees * Math.PI) / 180
}

function assertValidCoordinates(point) {
  if (!point || !Number.isFinite(point.lat) || !Number.isFinite(point.lng)) {
    throw new TypeError('역 좌표는 유한한 숫자여야 합니다.')
  }
}

function findStation(name) {
  const station = stationByName.get(name)

  if (!station) {
    throw new Error(`알 수 없는 역입니다: ${String(name)}`)
  }

  return station
}

export function straightLineDistance(from, to) {
  assertValidCoordinates(from)
  assertValidCoordinates(to)

  const latDelta = toRadians(to.lat - from.lat)
  const lngDelta = toRadians(to.lng - from.lng)
  const fromLat = toRadians(from.lat)
  const toLat = toRadians(to.lat)

  const a =
    Math.sin(latDelta / 2) ** 2 +
    Math.cos(fromLat) * Math.cos(toLat) * Math.sin(lngDelta / 2) ** 2

  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export function estimateTravelMinutes(from, to) {
  return straightLineDistance(from, to) * 2.5 + 10
}

export function travelTime(fromName, toName) {
  const from = findStation(fromName)
  const to = findStation(toName)

  if (fromName === toName) {
    return { minutes: 0, transfers: 0 }
  }

  return {
    minutes: estimateTravelMinutes(from, to),
    transfers: 0,
  }
}

function compareByStationName(a, b) {
  return a.station.name.localeCompare(b.station.name, 'ko')
}

function compareFair(a, b) {
  return a.maxTime - b.maxTime || a.spread - b.spread || compareByStationName(a, b)
}

function compareWeighted(a, b) {
  return a.weightedScore - b.weightedScore || a.maxTime - b.maxTime || compareByStationName(a, b)
}

export function rankStations(participants, stations, { mode = 'fair' } = {}) {
  if (!participants?.length || !stations?.length) return []

  if (!VALID_MODES.has(mode)) {
    throw new Error(`지원하지 않는 순위 모드입니다: ${String(mode)}`)
  }

  const results = stations.map((station) => {
    const times = participants.map((participant) => ({
      participantId: participant.id,
      ...travelTime(participant.station.name, station.name),
    }))
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
      totalTransfers: times.reduce((total, { transfers }) => total + transfers, 0),
      weightedScore: maxTime * 0.7 + spread * 0.3,
    }
  })

  return results.sort(mode === 'weighted' ? compareWeighted : compareFair)
}

export function roundedMinutes(minutes) {
  return Math.round(minutes)
}
