import { afterEach, describe, expect, it, vi } from 'vitest'
import { createTemplateVerdict, generateVerdict } from './verdict.js'

describe('판결문 대체 처리', () => {
  const result = {
    station: { name: '서울역' },
    maxTime: 38.4,
    spread: 7.6,
    times: [],
  }

  afterEach(() => vi.restoreAllMocks())

  it('템플릿은 주문, 판결 이유, 선고를 포함하고 5줄 이하다', () => {
    const text = createTemplateVerdict(result, '밥')
    expect(text).toContain('주문:')
    expect(text).toContain('판결 이유:')
    expect(text).toContain('선고:')
    expect(text.split('\n').length).toBeLessThanOrEqual(5)
  })

  it('API 키가 없으면 네트워크 호출 없이 템플릿을 반환한다', async () => {
    const verdict = await generateVerdict(result, '밥', [], '')
    expect(verdict.source).toBe('template')
    expect(verdict.text).toContain('서울역')
  })

  it('첫 모델을 쓸 수 없으면 호환 모델로 한 번 더 요청한다', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce({ ok: false, status: 404 })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          candidates: [{ content: { parts: [{ text: '주문: 서울역\n판결 이유: 공평함\n선고: 집합' }] } }],
        }),
      })

    const verdict = await generateVerdict(result, '밥', [], 'test-key')

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock.mock.calls[1][0]).toContain('gemini-2.5-flash-lite')
    expect(verdict.source).toBe('gemini')
  })
})
