import { afterEach, describe, expect, it } from 'vitest'
import { createApiServer } from './index.js'

const servers = new Set()

async function listen(server) {
  servers.add(server)
  await new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })

  const address = server.address()
  return `http://127.0.0.1:${address.port}`
}

afterEach(async () => {
  await Promise.all(
    [...servers].map(
      (server) =>
        new Promise((resolve) => {
          server.close(resolve)
          server.closeAllConnections()
        }),
    ),
  )
  servers.clear()
})

describe('API server without an Anthropic key', () => {
  it.each([
    [
      '/api/verdict',
      { purpose: '밥', participants: [{ id: 1, stationName: '강남' }], ranked: [] },
    ],
    ['/api/extract', { chat: '민수: 강남에서 출발' }],
  ])('starts and returns no_key from POST %s', async (pathname, payload) => {
    const baseUrl = await listen(createApiServer())
    const response = await fetch(`${baseUrl}${pathname}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ ok: false, reason: 'no_key' })
  })
})
