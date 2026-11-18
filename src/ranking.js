const EARTH_RADIUS_KM = 6371

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

export function estimateTravelMinutes(from, to) {
  return straightLineDistance(from, to) * 2.5 + 10
}

export function rankStations(participants, stations) {
  if (!participants?.length || !stations?.length) return []

  return stations
    .map((station) => {
      const times = participants.map((participant) => ({
        participantId: participant.id,
        minutes: estimateTravelMinutes(participant.station, station),
      }))
      const minuteValues = times.map(({ minutes }) => minutes)
      const maxTime = Math.max(...minuteValues)
      const minTime = Math.min(...minuteValues)
      const score = maxTime * 0.7 + (maxTime - minTime) * 0.3

      return {
        station,
        times,
        maxTime,
        minTime,
        spread: maxTime - minTime,
        score,
      }
    })
    .sort((a, b) => a.score - b.score || a.maxTime - b.maxTime || a.station.name.localeCompare(b.station.name, 'ko'))
}

export function roundedMinutes(minutes) {
  return Math.round(minutes)
}
