import { afterEach, describe, expect, it, vi } from 'vitest'
import { requestExtract, requestVerdict } from './api.js'
import { createTemplateVerdict } from './verdict.js'

const result = {
  station: { name: '서울역', lat: 37.5547, lng: 126.9706 },
  times: [
    { participantId: 1, minutes: 38.4, transfers: 0 },
    { participantId: 2, minutes: 30.8, transfers: 0 },
  ],
  maxTime: 38.4,
  minTime: 30.8,
  spread: 7.6,
  totalTransfers: 0,
}

const request = {
  purpose: '밥',
  participants: [
    { id: 1, stationName: '강남' },
    { id: 2, stationName: '홍대입구' },
  ],
  ranked: [result],
}

afterEach(() => vi.restoreAllMocks())

describe('템플릿 판결문', () => {
  it('API와 같은 주문, 판결 이유, 선고 구조를 반환한다', () => {
    expect(createTemplateVerdict(result, '밥')).toEqual({
      order: '이번 밥 약속 장소는 서울역으로 정한다.',
      reason: '누구도 약 38분을 넘기지 않고, 이동시간 차이도 약 8분에 그친다. 한 사람의 희생으로 세운 약속은 오래가지 못한다는 점도 참작했다.',
      sentence: '전원은 이 판결에 따라 서울역으로 모일 것.',
    })
  })
})

describe('requestVerdict', () => {
  it('약속된 요청 형식으로 호출하고 Claude 판결문을 반환한다', async () => {
    const apiResponse = {
      ok: true,
      source: 'claude',
      verdict: { order: '주문', reason: '판결 이유', sentence: '선고' },
    }
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => apiResponse,
    })

    await expect(requestVerdict(request)).resolves.toEqual(apiResponse)
    expect(fetchMock).toHaveBeenCalledWith('/api/verdict', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    })
  })

  it.each([
    ['서버 실패', { ok: true, json: async () => ({ ok: false, reason: 'no_key' }) }],
    ['잘못된 성공 응답', { ok: true, json: async () => ({ ok: true, source: 'claude', verdict: null }) }],
  ])('%s 시 템플릿 판결문으로 대체한다', async (_label, response) => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(response)

    const actual = await requestVerdict(request)

    expect(actual.ok).toBe(true)
    expect(actual.source).toBe('template')
    expect(actual.verdict).toEqual(createTemplateVerdict(result, '밥'))
  })

  it('네트워크 오류 시 템플릿 판결문으로 대체한다', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'))

    const actual = await requestVerdict(request)

    expect(actual.source).toBe('template')
    expect(actual.verdict.order).toContain('서울역')
  })
})

describe('requestExtract', () => {
  it('약속된 요청 형식으로 추출 API를 호출한다', async () => {
    const apiResponse = {
      ok: true,
      participants: [{ name: '민수', station: '강남' }],
      purpose: '밥',
    }
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => apiResponse,
    })

    await expect(requestExtract({ chat: '민수: 강남에서 출발해' })).resolves.toEqual(apiResponse)
    expect(fetchMock).toHaveBeenCalledWith('/api/extract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat: '민수: 강남에서 출발해' }),
    })
  })

  it('네트워크 오류를 실패 응답으로 바꾼다', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'))

    await expect(requestExtract({ chat: '대화' })).resolves.toEqual({ ok: false, reason: 'error' })
  })
})
