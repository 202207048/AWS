// 30개 후보역 주변 카페/음식점/놀 곳을 실제 데이터로 미리 받아 server/data/places-cache.json에 저장한다.
// 사용: node server/scripts/prefetch-places.js
// .env에 KAKAO_REST_API_KEY가 있으면 카카오, 없으면 OpenStreetMap(Nominatim, 초당 1회 이하)을 쓴다.
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { STATIONS } from '../../src/stations.js'
import { loadLocalEnv, PLACES_CACHE_PATH } from '../index.js'
import { CATEGORIES, fetchKakaoPlaces, fetchOsmPlaces, RADIUS_M } from '../places.js'

const NOMINATIM_DELAY_MS = 1_100
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

loadLocalEnv()
const kakaoKey = process.env.KAKAO_REST_API_KEY?.trim()
const source = kakaoKey ? 'kakao' : 'osm'
const cache = { generatedAt: new Date().toISOString(), source, radius: RADIUS_M, stations: {} }
let failures = 0

for (const station of STATIONS) {
  cache.stations[station.name] = {}
  for (const category of Object.keys(CATEGORIES)) {
    try {
      const places = kakaoKey
        ? await fetchKakaoPlaces(station, category, kakaoKey)
        : await fetchOsmPlaces(station, category, { delayMs: NOMINATIM_DELAY_MS })
      cache.stations[station.name][category] = places
      console.log(`${station.name} ${category}: ${places.length}`)
    } catch (error) {
      failures += 1
      console.warn(`${station.name} ${category}: 실패 (${error.message})`)
    }
    if (!kakaoKey) await sleep(NOMINATIM_DELAY_MS)
  }
}

mkdirSync(dirname(PLACES_CACHE_PATH), { recursive: true })
writeFileSync(PLACES_CACHE_PATH, `${JSON.stringify(cache, null, 2)}\n`)
console.log(`저장: ${PLACES_CACHE_PATH} (source=${source}, 실패 ${failures}건)`)
