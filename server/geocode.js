// 주소·장소 검색. 카카오 키가 있으면 카카오 키워드 검색, 없으면 OpenStreetMap(Nominatim).
// Nominatim 정책상 자동완성(입력할 때마다 검색)은 금지이므로 화면은 "검색" 버튼/Enter로만 호출한다.
// 서버는 같은 검색어를 캐시하고, Nominatim 호출은 1초에 1번 이하로 줄 세운다.

const USER_AGENT = 'meeting-place-judge-demo/1.0 (student contest project)'
const MAX_RESULTS = 8
const TIMEOUT_MS = 8_000
// 수도권(서울·인천·경기) 대략 범위
const BOUNDS = { west: 126.3, east: 127.9, south: 36.9, north: 38.3 }

function inBounds({ lat, lng }) {
  return lat >= BOUNDS.south && lat <= BOUNDS.north && lng >= BOUNDS.west && lng <= BOUNDS.east
}

function clean(results) {
  const seen = new Set()
  return results
    .filter((r) => r.name && Number.isFinite(r.lat) && Number.isFinite(r.lng) && inBounds(r))
    .filter((r) => {
      const key = `${r.name}|${r.lat.toFixed(4)}|${r.lng.toFixed(4)}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    .slice(0, MAX_RESULTS)
}

export async function searchOsm(query, { fetchImpl = fetch, signal } = {}) {
  const params = new URLSearchParams({
    format: 'jsonv2',
    q: query,
    limit: '15',
    countrycodes: 'kr',
    viewbox: `${BOUNDS.west},${BOUNDS.north},${BOUNDS.east},${BOUNDS.south}`,
    bounded: '1',
    'accept-language': 'ko',
  })
  const response = await fetchImpl(`https://nominatim.openstreetmap.org/search?${params}`, {
    headers: { 'User-Agent': USER_AGENT },
    signal,
  })
  if (!response.ok) throw new Error(`osm ${response.status}`)
  const rows = await response.json()
  return clean(
    rows.map((row) => {
      const parts = String(row.display_name ?? '').split(',').map((s) => s.trim())
      return {
        name: row.name || parts[0] || null,
        address: parts.slice(1, 4).join(' ') || null,
        lat: Number(row.lat),
        lng: Number(row.lon),
      }
    }),
  )
}

export async function searchKakao(query, apiKey, { fetchImpl = fetch, signal } = {}) {
  const params = new URLSearchParams({ query, size: '15' })
  const response = await fetchImpl(`https://dapi.kakao.com/v2/local/search/keyword.json?${params}`, {
    headers: { Authorization: `KakaoAK ${apiKey}` },
    signal,
  })
  if (!response.ok) throw new Error(`kakao ${response.status}`)
  const data = await response.json()
  return clean(
    (data.documents ?? []).map((doc) => ({
      name: doc.place_name || null,
      address: doc.road_address_name || doc.address_name || null,
      lat: Number(doc.y),
      lng: Number(doc.x),
    })),
  )
}

export function createGeocodeService({ kakaoKey, fetchImpl = fetch, minIntervalMs = 1_100 } = {}) {
  const cache = new Map()
  let queue = Promise.resolve()
  let lastCall = 0

  // Nominatim 호출을 순서대로, 최소 간격을 두고 실행
  function throttled(task) {
    const run = queue.then(async () => {
      const wait = lastCall + minIntervalMs - Date.now()
      if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait))
      lastCall = Date.now()
      return task()
    })
    queue = run.catch(() => {})
    return run
  }

  return async function geocode({ q } = {}) {
    const query = typeof q === 'string' ? q.trim().slice(0, 60) : ''
    if (query.length < 2) return { ok: false, reason: 'too_short' }
    if (cache.has(query)) return cache.get(query)

    const useKakao = typeof kakaoKey === 'string' && kakaoKey.trim().length > 0
    try {
      const signal = AbortSignal.timeout(TIMEOUT_MS)
      const results = useKakao
        ? await searchKakao(query, kakaoKey.trim(), { fetchImpl, signal })
        : await throttled(() => searchOsm(query, { fetchImpl, signal }))
      const result = results.length
        ? { ok: true, source: useKakao ? 'kakao' : 'osm', results }
        : { ok: false, reason: 'empty' }
      cache.set(query, result)
      return result
    } catch (error) {
      console.warn('[geocode] 검색 실패:', error?.message ?? 'unknown')
      return { ok: false, reason: 'unavailable' }
    }
  }
}
