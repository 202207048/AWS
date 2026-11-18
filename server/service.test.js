import { describe, expect, it } from 'vitest'
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
})
