export const PLACE_CATEGORIES = Object.freeze([
  { id: 'cafe', label: '카페' },
  { id: 'food', label: '음식점' },
  { id: 'play', label: '놀 곳' },
])

/**
 * GET /api/places 호출 (PLAN 17절).
 * 성공하면 서버 응답 JSON({ ok: true, source, station, radius, category, places })을 그대로 돌려준다.
 * 실패(네트워크 오류, 잘못된 JSON, ok:false, 형식 오류)면 { ok: false, reason }을 돌려주고 예외를 던지지 않는다.
 */
export async function fetchPlaces(stationName, category, { signal } = {}) {
  try {
    const params = new URLSearchParams({ station: String(stationName ?? ''), category: String(category ?? '') })
    const response = await fetch(`/api/places?${params}`, { signal })

    let data
    try {
      data = await response.json()
    } catch {
      return { ok: false, reason: response.ok ? 'bad_response' : 'error' }
    }

    if (data?.ok === false) {
      return { ok: false, reason: typeof data.reason === 'string' ? data.reason : 'error' }
    }
    if (!response.ok) return { ok: false, reason: 'error' }
    if (data?.ok !== true || !Array.isArray(data.places)) return { ok: false, reason: 'bad_response' }

    return data
  } catch (error) {
    return { ok: false, reason: error?.name === 'AbortError' ? 'aborted' : 'network' }
  }
}
