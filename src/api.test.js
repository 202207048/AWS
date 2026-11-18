import { afterEach, describe, expect, it, vi } from 'vitest'
import { extractErrorMessage, requestExtract, requestVerdict } from './api.js'
import { createTemplateVerdict } from './verdict.js'

const result = {
  station: { name: '사당', lat: 37.4765, lng: 126.9816 },
  times: [
    { participantId: 1, minutes: 38.4, transfers: 0 },
    { participantId: 2, minutes: 30.8, transfers: 0 },
  ],
  maxTime: 38.4,
  minTime: 30.8,
  spread: 7.6,
  totalTransfers: 0,
  weightedScore: 29.16,
}

const request = {
  purpose: '밥',
  mode: 'weighted',
  participants: [
    { id: 1, stationName: '강남' },
    { id: 2, stationName: '홍대입구' },
  ],
  ranked: [result],
}

function stubFetch(impl) {
  const fetchMock = vi.fn(impl)
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

function sentBody(fetchMock) {
  return JSON.parse(fetchMock.mock.calls[0][1].body)
}

afterEach(() => vi.unstubAllGlobals())

describe('requestVerdict', () => {
  it('Claude 성공 응답은 그대로 돌려주고 mode를 요청에 포함한다', async () => {
    const apiResponse = {
      ok: true,
      source: 'claude',
      verdict: { order: '주문', reason: '판결 이유', sentence: '선고' },
    }
    const fetchMock = stubFetch(async () => ({ ok: true, json: async () => apiResponse }))

    await expect(requestVerdict(request)).resolves.toEqual(apiResponse)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0][0]).toBe('/api/verdict')
    expect(fetchMock.mock.calls[0][1]).toMatchObject({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    })
    expect(sentBody(fetchMock)).toEqual(request)
  })

  it('mode를 생략하면 fair로 보낸다', async () => {
    const fetchMock = stubFetch(async () => ({ ok: true, json: async () => ({ ok: false, reason: 'no_key' }) }))
    const { mode: _mode, ...withoutMode } = request

    await requestVerdict(withoutMode)

    expect(sentBody(fetchMock).mode).toBe('fair')
  })

  it.each([
    ['서버 실패', async () => ({ ok: true, json: async () => ({ ok: false, reason: 'no_key' }) })],
    ['HTTP 오류', async () => ({ ok: false, json: async () => ({ ok: false, reason: 'timeout' }) })],
    ['잘못된 성공 응답', async () => ({ ok: true, json: async () => ({ ok: true, source: 'claude', verdict: null }) })],
    ['네트워크 오류', async () => { throw new Error('offline') }],
  ])('%s 시 템플릿 판결문으로 대체한다', async (_label, impl) => {
    stubFetch(impl)

    const actual = await requestVerdict(request)

    expect(actual).toEqual({
      ok: true,
      source: 'template',
      verdict: createTemplateVerdict(result, '밥'),
    })
  })
})

describe('requestExtract', () => {
  it('추출 API 응답을 그대로 돌려준다', async () => {
    const apiResponse = {
      ok: true,
      participants: [
        { name: '민수', station: '잠실' },
        { name: '서연', station: null, hint: '일산' },
      ],
      purpose: '밥',
    }
    const fetchMock = stubFetch(async () => ({ ok: true, json: async () => apiResponse }))

    await expect(requestExtract({ chat: '민수: 잠실에서 갈게' })).resolves.toEqual(apiResponse)
    expect(fetchMock.mock.calls[0][0]).toBe('/api/extract')
    expect(sentBody(fetchMock)).toEqual({ chat: '민수: 잠실에서 갈게' })
  })

  it('서버 실패 이유를 그대로 돌려준다', async () => {
    stubFetch(async () => ({ ok: true, json: async () => ({ ok: false, reason: 'too_long' }) }))

    await expect(requestExtract({ chat: '대화' })).resolves.toEqual({ ok: false, reason: 'too_long' })
  })

  it('네트워크 오류를 실패 응답으로 바꾼다', async () => {
    stubFetch(async () => { throw new Error('offline') })

    await expect(requestExtract({ chat: '대화' })).resolves.toEqual({ ok: false, reason: 'error' })
  })
})

describe('extractErrorMessage', () => {
  it('실패 이유를 짧은 안내로 바꾼다', () => {
    expect(extractErrorMessage('too_long')).toBe('대화가 너무 길어요. 일부만 붙여넣어 주세요.')
    expect(extractErrorMessage('no_key')).toBe('AI 키가 없어 직접 선택해 주세요.')
    expect(extractErrorMessage('timeout')).toContain('직접 선택해 주세요.')
    expect(extractErrorMessage(undefined)).toContain('직접 선택해 주세요.')
  })
})
