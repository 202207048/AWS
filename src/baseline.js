import { buildStationResult, straightLineDistance } from './ranking.js'

/**
 * 기존 방식: 출발역 좌표의 산술 평균점에서 직선거리로 가장 가까운 역.
 * 이동시간은 travelTime으로 계산하고, rankStations 결과와 같은 StationResult 형식을 돌려준다.
 * 참여자나 후보역이 없으면 null.
 */
export function baselineStation(participants, stations) {
  if (!participants?.length || !stations?.length) return null

  const center = {
    lat: participants.reduce((total, { station }) => total + station.lat, 0) / participants.length,
    lng: participants.reduce((total, { station }) => total + station.lng, 0) / participants.length,
  }

  let nearest = null
  let nearestDistance = Infinity

  for (const station of stations) {
    const distance = straightLineDistance(center, station)
    if (
      distance < nearestDistance ||
      (distance === nearestDistance && station.name.localeCompare(nearest.name, 'ko') < 0)
    ) {
      nearest = station
      nearestDistance = distance
    }
  }

  return buildStationResult(participants, nearest)
}
