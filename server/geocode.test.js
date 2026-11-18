import { describe, expect, it, vi } from 'vitest'
import { createGeocodeService } from './geocode.js'

const json = (body) => ({ ok: true, status: 200, json: async () => body })

describe('createGeocodeService', () => {
  it('두 글자 미만은 too_short', async () => {
    const geocode = createGeocodeService({ fetchImpl: vi.fn() })
    await expect(geocode({ q: '일' })).resolves.toEqual({ ok: false, reason: 'too_short' })
  })

  it('OSM 결과를 수도권 안의 것만, 이름·주소와 함께 돌려주고 같은 검색어는 캐시한다', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      json([
        { name: '일산동구', display_name: '일산동구, 고양시, 경기도, 대한민국', lat: '37.6584', lon: '126.7742' },
        { name: '부산', display_name: '부산, 대한민국', lat: '35.1796', lon: '129.0756' },
      ]),
    )
    const geocode = createGeocodeService({ fetchImpl, minIntervalMs: 0 })
    const first = await geocode({ q: '일산' })
    const second = await geocode({ q: '일산' })

    expect(first).toEqual({
      ok: true,
      source: 'osm',
      results: [{ name: '일산동구', address: '고양시 경기도 대한민국', lat: 37.6584, lng: 126.7742 }],
    })
    expect(second).toBe(first)
    expect(fetchImpl).toHaveBeenCalledOnce()
    expect(fetchImpl.mock.calls[0][0]).toContain('nominatim.openstreetmap.org')
  })

  it('카카오 키가 있으면 카카오 키워드 검색을 쓴다', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      json({ documents: [{ place_name: '정자역', road_address_name: '경기 성남시 분당구', y: '37.3670', x: '127.1086' }] }),
    )
    const geocode = createGeocodeService({ kakaoKey: 'k', fetchImpl })
    const result = await geocode({ q: '분당 정자동' })

    expect(result.source).toBe('kakao')
    expect(result.results[0]).toMatchObject({ name: '정자역', address: '경기 성남시 분당구' })
    expect(fetchImpl.mock.calls[0][1].headers.Authorization).toBe('KakaoAK k')
  })

  it('결과가 없으면 empty, 실패하면 unavailable', async () => {
    const empty = createGeocodeService({ fetchImpl: vi.fn().mockResolvedValue(json([])), minIntervalMs: 0 })
    await expect(empty({ q: '없는곳' })).resolves.toEqual({ ok: false, reason: 'empty' })

    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const broken = createGeocodeService({ fetchImpl: vi.fn().mockRejectedValue(new Error('down')), minIntervalMs: 0 })
    await expect(broken({ q: '강남' })).resolves.toEqual({ ok: false, reason: 'unavailable' })
  })
})
