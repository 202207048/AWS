// 약속 시각에서 이동시간(분, 반올림)과 여유 시간을 빼 출발 시각(HH:MM)을 구한다. 자정을 넘으면 전날 시각으로 감는다.
export const DEPARTURE_BUFFER_MINUTES = 5
const DAY_MINUTES = 24 * 60

export function parseClock(value) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(String(value ?? '').trim())
  if (!match) return null
  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (hours > 23 || minutes > 59) return null
  return hours * 60 + minutes
}

export function formatClock(totalMinutes) {
  const normalized = ((Math.round(totalMinutes) % DAY_MINUTES) + DAY_MINUTES) % DAY_MINUTES
  const hours = Math.floor(normalized / 60)
  const minutes = normalized % 60
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
}

/** meetingTime "19:00", travelMinutes 47.6 → "18:07" (48분 + 여유 5분). 잘못된 입력이면 null. */
export function departureTime(meetingTime, travelMinutes, buffer = DEPARTURE_BUFFER_MINUTES) {
  const meeting = parseClock(meetingTime)
  if (meeting === null || !Number.isFinite(travelMinutes)) return null
  const departure = meeting - Math.round(travelMinutes) - buffer
  // 자정을 넘겨 전날 출발해야 하면 "전날"을 붙인다
  return departure < 0 ? `전날 ${formatClock(departure)}` : formatClock(departure)
}
