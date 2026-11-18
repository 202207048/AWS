import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchPlaces } from './places.js'

const jsonResponse = (body, { ok = true, status = 200 } = {}) => ({
  ok,
  status,
  json: async () => body,
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('fetchPlaces', () => {
  it('성공하면 /api/places를 부르고 응답 JSON을 그대로 돌려준다', async () => {
    const body = {
      ok: true,
      source: 'osm',
      station: { name: '사당', lat: 37.4765, lng: 126.9816 },
      radius: 500,
      category: 'cafe',
      places: [{ name: '카페', lat: 37.477, lng: 126.982, distance: 60, address: null, url: null }],
    }
    const fetchMock = vi.fn(async () => jsonResponse(body))
    vi.stubGlobal('fetch', fetchMock)

    await expect(fetchPlaces('사당', 'cafe')).resolves.toEqual(body)

    const url = new URL(fetchMock.mock.calls[0][0], 'http://localhost')
    expect(url.pathname).toBe('/api/places')
    expect(url.searchParams.get('station')).toBe('사당')
    expect(url.searchParams.get('category')).toBe('cafe')
  })

  it('서버가 꺼져 있으면(네트워크 오류) 예외 없이 ok:false', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new TypeError('Failed to fetch')
    }))

    await expect(fetchPlaces('사당', 'cafe')).resolves.toEqual({ ok: false, reason: 'network' })
  })

  it('서버의 ok:false 응답은 reason을 그대로 전달한다', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ ok: false, reason: 'unknown_station' })))

    await expect(fetchPlaces('없는역', 'cafe')).resolves.toEqual({ ok: false, reason: 'unknown_station' })
  })

  it('HTTP 오류나 JSON이 아닌 응답도 ok:false', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: false,
      status: 502,
      json: async () => {
        throw new SyntaxError('Unexpected token <')
      },
    })))
    await expect(fetchPlaces('사당', 'cafe')).resolves.toMatchObject({ ok: false })

    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => {
        throw new SyntaxError('Unexpected token <')
      },
    })))
    await expect(fetchPlaces('사당', 'cafe')).resolves.toEqual({ ok: false, reason: 'bad_response' })
  })
})
