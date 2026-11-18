import { describe, expect, it, vi } from 'vitest'
import { createService } from './service.js'

const noKeyResponse = { ok: false, reason: 'no_key' }

describe('createService', () => {
  it.each([undefined, '', '   '])('returns no_key when the API key is %j', async (apiKey) => {
    const service = createService({ apiKey })

    await expect(
      service.verdict({ purpose: '밥', participants: [], ranked: [] }),
    ).resolves.toEqual(noKeyResponse)
    await expect(service.extract({ chat: '민수: 강남에서 출발' })).resolves.toEqual(
      noKeyResponse,
    )
  })

  it('키가 있으면 주입한 Claude 클라이언트로 판결문을 요청한다', async () => {
    const parse = vi.fn().mockResolvedValue({
      stop_reason: 'end_turn',
      parsed_output: { order: '사당역으로 정한다.', reason: '공평하다.', sentence: '모일 것.' },
    })
    const service = createService({ apiKey: 'sk-ant-TEST', client: { messages: { parse } } })
    const result = await service.verdict({
      purpose: '밥',
      participants: [{ id: 1, stationName: '강남' }],
      ranked: [
        {
          station: { name: '사당' },
          times: [{ participantId: 1, minutes: 20, transfers: 0 }],
          maxTime: 20,
          minTime: 20,
          spread: 0,
        },
      ],
    })

    expect(parse).toHaveBeenCalledOnce()
    expect(result).toMatchObject({ ok: true, source: 'claude' })
  })
})
