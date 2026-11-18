import { STATIONS } from '../src/stations.js'

export const RADIUS_M = 500
const MAX_PLACES = 15
const LIVE_TIMEOUT_MS = 8_000
const USER_AGENT = 'meeting-place-judge-demo/1.0 (student contest project)'

/** 분류별 검색어. osm = Nominatim amenity 검색어, kakao = 카카오 카테고리 그룹 코드 */
export const CATEGORIES = Object.freeze({
  cafe: { label: '카페', osm: ['cafe'], kakao: ['CE7'] },
  food: { label: '음식점', osm: ['restaurant', 'fast_food'], kakao: ['FD6'] },
  play: { label: '놀 곳', osm: ['cinema', 'karaoke_box', 'park'], kakao: ['CT1', 'AT4'] },
})

const stationByName = new Map(STATIONS.map((station) => [station.name, station]))

export function findStation(name) {
  if (typeof name !== 'string') return null
  return stationByName.get(name.trim().replace(/역$/, '')) ?? null
}

export function distanceMeters(from, to) {
  const toRadians = (degrees) => (degrees * Math.PI) / 180
  const latDelta = toRadians(to.lat - from.lat)
  const lngDelta = toRadians(to.lng - from.lng)
  const a =
    Math.sin(latDelta / 2) ** 2 +
    Math.cos(toRadians(from.lat)) * Math.cos(toRadians(to.lat)) * Math.sin(lngDelta / 2) ** 2
  return Math.round(6_371_000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)))
}

function finalizePlaces(station, places) {
  const seen = new Set()
  return places
    .filter((place) => place.name && Number.isFinite(place.lat) && Number.isFinite(place.lng))
    .map((place) => ({ ...place, distance: distanceMeters(station, place) }))
    .filter((place) => place.distance <= RADIUS_M)
    .filter((place) => {
      const key = `${place.name}|${place.lat.toFixed(4)}|${place.lng.toFixed(4)}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    .sort((a, b) => a.distance - b.distance || a.name.localeCompare(b.name, 'ko'))
    .slice(0, MAX_PLACES)
}

function viewbox(station) {
  const latDelta = RADIUS_M / 111_320
  const lngDelta = RADIUS_M / (111_320 * Math.cos((station.lat * Math.PI) / 180))
  return [
    station.lng - lngDelta,
    station.lat + latDelta,
    station.lng + lngDelta,
    station.lat - latDelta,
  ]
    .map((value) => value.toFixed(5))
    .join(',')
}

/** OpenStreetMap Nominatim 검색 (키 불필요, 초당 1회 이하로 사용) */
export async function fetchOsmPlaces(station, category, { fetchImpl = fetch, signal, delayMs = 0 } = {}) {
  const places = []
  for (const [index, term] of CATEGORIES[category].osm.entries()) {
    if (index > 0 && delayMs > 0) await new Promise((resolve) => setTimeout(resolve, delayMs))
    const params = new URLSearchParams({
      format: 'jsonv2',
      limit: '40',
      bounded: '1',
      viewbox: viewbox(station),
      amenity: term,
      'accept-language': 'ko',
    })
    const response = await fetchImpl(`https://nominatim.openstreetmap.org/search?${params}`, {
      headers: { 'User-Agent': USER_AGENT },
      signal,
    })
    if (!response.ok) throw new Error(`osm ${response.status}`)
    const rows = await response.json()
    for (const row of rows) {
      places.push({
        name: row.name || null,
        lat: Number(row.lat),
        lng: Number(row.lon),
        address: null,
        url: row.osm_type && row.osm_id ? `https://www.openstreetmap.org/${row.osm_type}/${row.osm_id}` : null,
      })
    }
  }
  return finalizePlaces(station, places)
}

/** 카카오 로컬 카테고리 검색 (KAKAO_REST_API_KEY 필요) */
export async function fetchKakaoPlaces(station, category, apiKey, { fetchImpl = fetch, signal } = {}) {
  const places = []
  for (const code of CATEGORIES[category].kakao) {
    const params = new URLSearchParams({
      category_group_code: code,
      x: String(station.lng),
      y: String(station.lat),
      radius: String(RADIUS_M),
      sort: 'distance',
      size: '15',
    })
    const response = await fetchImpl(`https://dapi.kakao.com/v2/local/search/category.json?${params}`, {
      headers: { Authorization: `KakaoAK ${apiKey}` },
      signal,
    })
    if (!response.ok) throw new Error(`kakao ${response.status}`)
    const data = await response.json()
    for (const doc of data.documents ?? []) {
      places.push({
        name: doc.place_name || null,
        lat: Number(doc.y),
        lng: Number(doc.x),
        address: doc.road_address_name || doc.address_name || null,
        url: doc.place_url || null,
      })
    }
  }
  return finalizePlaces(station, places)
}

function hasKey(value) {
  return typeof value === 'string' && value.trim().length > 0
}

/**
 * 주변 장소 서비스. 캐시(미리 받아 둔 실제 데이터)를 먼저 쓰고, 없으면 실시간으로 가져온다.
 * 항상 PLAN.md 17절 형식의 객체를 돌려주고 예외를 던지지 않는다.
 */
export function createPlacesService({ kakaoKey, cache, fetchImpl = fetch } = {}) {
  const memory = new Map()

  return async function getPlaces({ station: stationName, category } = {}) {
    const station = findStation(stationName)
    if (!station) return { ok: false, reason: 'unknown_station' }
    if (!Object.hasOwn(CATEGORIES, category)) return { ok: false, reason: 'bad_category' }

    const base = {
      ok: true,
      station: { name: station.name, lat: station.lat, lng: station.lng },
      radius: RADIUS_M,
      category,
    }

    const cached = cache?.stations?.[station.name]?.[category]
    if (Array.isArray(cached)) return { ...base, source: cache.source ?? 'osm', places: cached }

    const memoKey = `${station.name}|${category}`
    if (memory.has(memoKey)) return memory.get(memoKey)

    try {
      const signal = AbortSignal.timeout(LIVE_TIMEOUT_MS)
      const useKakao = hasKey(kakaoKey)
      const places = useKakao
        ? await fetchKakaoPlaces(station, category, kakaoKey.trim(), { fetchImpl, signal })
        : await fetchOsmPlaces(station, category, { fetchImpl, signal })
      const result = { ...base, source: useKakao ? 'kakao' : 'osm', places }
      memory.set(memoKey, result)
      return result
    } catch (error) {
      console.warn('[places] 주변 장소 조회 실패:', error?.message ?? 'unknown')
      return { ok: false, reason: 'unavailable' }
    }
  }
}
