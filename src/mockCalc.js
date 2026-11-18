import { STATIONS } from './stations.js'

const EARTH_RADIUS_KM = 6371
const stationByName = new Map(STATIONS.map((station) => [station.name, station]))

function toRadians(degrees) {
  return (degrees * Math.PI) / 180
}

function straightLineDistance(from, to) {
  const latDelta = toRadians(to.lat - from.lat)
  const lngDelta = toRadians(to.lng - from.lng)
  const fromLat = toRadians(from.lat)
  const toLat = toRadians(to.lat)
  const a =
    Math.sin(latDelta / 2) ** 2 +
    Math.cos(fromLat) * Math.cos(toLat) * Math.sin(lngDelta / 2) ** 2

  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function stationResult(participants, station) {
  const times = participants.map((participant) => {
    const estimate = travelTime(participant.station.name, station.name)
    return { participantId: participant.id, ...estimate }
  })
  const minuteValues = times.map(({ minutes }) => minutes)
  const maxTime = Math.max(...minuteValues)
  const minTime = Math.min(...minuteValues)

  return {
    station,
    times,
    maxTime,
    minTime,
    spread: maxTime - minTime,
    totalTransfers: times.reduce((sum, { transfers }) => sum + transfers, 0),
  }
}

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

export function rankStations(participants, stations) {
  if (!participants?.length || !stations?.length) return []

  return stations
    .map((station) => stationResult(participants, station))
    .sort((a, b) =>
      a.maxTime - b.maxTime ||
      a.spread - b.spread ||
      a.totalTransfers - b.totalTransfers ||
      a.station.name.localeCompare(b.station.name, 'ko'),
    )
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
