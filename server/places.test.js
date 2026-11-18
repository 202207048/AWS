import { describe, expect, it, vi } from 'vitest'
import { createPlacesService, distanceMeters, findStation } from './places.js'

const sadang = findStation('사당')

function jsonResponse(body, ok = true, status = 200) {
  return { ok, status, json: async () => body }
}

describe('findStation', () => {
  it('"역"이 붙어도 찾는다', () => {
    expect(findStation('사당역')?.name).toBe('사당')
    expect(findStation('없는역')).toBeNull()
    expect(findStation('서울역')?.name).toBe('서울역')
  })
})

describe('createPlacesService', () => {
  it('캐시가 있으면 외부 호출 없이 캐시를 돌려준다', async () => {
    const fetchImpl = vi.fn()
    const cache = {
      source: 'osm',
      stations: { 사당: { cafe: [{ name: '카페A', lat: 37.4766, lng: 126.9817, distance: 14 }] } },
    }
    const getPlaces = createPlacesService({ cache, fetchImpl })
    const result = await getPlaces({ station: '사당', category: 'cafe' })

    expect(fetchImpl).not.toHaveBeenCalled()
    expect(result).toMatchObject({ ok: true, source: 'osm', radius: 500, category: 'cafe' })
    expect(result.station.name).toBe('사당')
    expect(result.places[0].name).toBe('카페A')
  })

  it('잘못된 역/분류는 오류 이유를 돌려준다', async () => {
    const getPlaces = createPlacesService({ fetchImpl: vi.fn() })
    await expect(getPlaces({ station: '없는역', category: 'cafe' })).resolves.toEqual({
      ok: false,
      reason: 'unknown_station',
    })
    await expect(getPlaces({ station: '사당', category: 'bar' })).resolves.toEqual({
      ok: false,
      reason: 'bad_category',
    })
  })

  it('카카오 키가 없으면 OSM 결과를 가까운 순으로, 반경 밖·중복·이름 없음은 빼고 돌려준다', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse([
        { name: '먼카페', lat: String(sadang.lat + 0.004), lon: String(sadang.lng), osm_type: 'node', osm_id: 1 },
        { name: '가까운카페', lat: String(sadang.lat + 0.0005), lon: String(sadang.lng), osm_type: 'node', osm_id: 2 },
        { name: '가까운카페', lat: String(sadang.lat + 0.0005), lon: String(sadang.lng), osm_type: 'node', osm_id: 2 },
        { name: '', lat: String(sadang.lat), lon: String(sadang.lng), osm_type: 'node', osm_id: 3 },
        { name: '반경밖', lat: String(sadang.lat + 0.02), lon: String(sadang.lng), osm_type: 'node', osm_id: 4 },
      ]),
    )
    const getPlaces = createPlacesService({ fetchImpl })
    const result = await getPlaces({ station: '사당', category: 'cafe' })

    expect(result.source).toBe('osm')
    expect(result.places.map((place) => place.name)).toEqual(['가까운카페', '먼카페'])
    expect(result.places[0].distance).toBeLessThan(result.places[1].distance)
    expect(fetchImpl.mock.calls[0][0]).toContain('nominatim.openstreetmap.org')
    expect(fetchImpl.mock.calls[0][1].headers['User-Agent']).toBeTruthy()
  })

  it('카카오 키가 있으면 카카오 API를 KakaoAK 헤더로 부른다', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse({
        documents: [
          {
            place_name: '카카오카페',
            y: String(sadang.lat + 0.001),
            x: String(sadang.lng),
            road_address_name: '서울 동작구',
            place_url: 'http://place.map.kakao.com/1',
          },
        ],
      }),
    )
    const getPlaces = createPlacesService({ kakaoKey: 'test-kakao', fetchImpl })
    const result = await getPlaces({ station: '사당', category: 'cafe' })

    expect(result.source).toBe('kakao')
    expect(result.places[0]).toMatchObject({ name: '카카오카페', address: '서울 동작구' })
    expect(fetchImpl.mock.calls[0][1].headers.Authorization).toBe('KakaoAK test-kakao')
  })

  it('외부 호출이 실패하면 unavailable', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const getPlaces = createPlacesService({ fetchImpl: vi.fn().mockRejectedValue(new Error('down')) })
    await expect(getPlaces({ station: '사당', category: 'food' })).resolves.toEqual({
      ok: false,
      reason: 'unavailable',
    })
  })
})

describe('distanceMeters', () => {
  it('같은 점은 0m', () => {
    expect(distanceMeters(sadang, sadang)).toBe(0)
  })
})
