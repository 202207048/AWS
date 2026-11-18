import { readFileSync } from 'node:fs'
import { APIConnectionTimeoutError } from '@anthropic-ai/sdk'
import { describe, expect, it, vi } from 'vitest'
import { CLAUDE_MODEL } from './claude.js'
import { extractFromChat } from './extract.js'

const sampleChat = readFileSync(new URL('./fixtures/sample-chat.txt', import.meta.url), 'utf8')

const expected = {
  ok: true,
  participants: [
    { name: '민수', station: '잠실' },
    { name: '지영', station: '강남' },
    { name: '현우', station: '수원' },
    { name: '서연', station: null, hint: '일산' },
  ],
  purpose: '밥',
}

function fakeClient(result) {
  const parse = typeof result === 'function' ? vi.fn(result) : vi.fn().mockResolvedValue(result)
  return { client: { messages: { parse } }, parse }
}

describe('extractFromChat', () => {
  it('샘플 단톡을 PLAN 16절 기대 결과 형식으로 돌려준다', async () => {
    const { client, parse } = fakeClient({
      stop_reason: 'end_turn',
      parsed_output: {
        participants: [
          { name: '민수', station: '잠실', hint: null },
          { name: '지영', station: '강남', hint: '회사' },
          { name: '현우', station: '수원', hint: null },
          { name: '서연', station: null, hint: '일산' },
        ],
        purpose: '밥',
      },
    })

    await expect(extractFromChat(client, { chat: sampleChat })).resolves.toEqual(expected)

    const params = parse.mock.calls[0][0]
    expect(params.model).toBe(CLAUDE_MODEL)
    expect(params.output_config.effort).toBe('low')
    expect(params).not.toHaveProperty('temperature')
    expect(params).not.toHaveProperty('thinking')
    expect(params.messages[0].content).toContain('서연: 나는 일산 살아')
  })

  it('모델이 순서를 바꿔도 대화 첫 등장 순으로 정렬한다', async () => {
    const { client } = fakeClient({
      stop_reason: 'end_turn',
      parsed_output: {
        participants: [
          { name: '지영', station: '강남', hint: null },
          { name: '현우', station: '수원', hint: null },
          { name: '서연', station: null, hint: '일산' },
          { name: '민수', station: '잠실', hint: null },
        ],
        purpose: '밥',
      },
    })
    await expect(extractFromChat(client, { chat: sampleChat })).resolves.toEqual(expected)
  })

  it('같은 이름은 한 번만, 최대 6명까지', async () => {
    const people = ['가', '나', '다', '라', '마', '바', '사'].map((name) => ({ name, station: '강남', hint: null }))
    const { client } = fakeClient({
      stop_reason: 'end_turn',
      parsed_output: { participants: [{ name: '가', station: '잠실', hint: null }, ...people], purpose: null },
    })
    const result = await extractFromChat(client, { chat: '대화' })

    expect(result.participants).toHaveLength(6)
    expect(result.participants[0]).toEqual({ name: '가', station: '잠실' })
    expect(result.purpose).toBeNull()
  })

  it('빈 대화는 호출하지 않고 error, 너무 긴 대화는 too_long', async () => {
    const { client, parse } = fakeClient({ stop_reason: 'end_turn', parsed_output: { participants: [], purpose: null } })
    await expect(extractFromChat(client, { chat: '   ' })).resolves.toEqual({ ok: false, reason: 'error' })
    await expect(extractFromChat(client, { chat: 'a'.repeat(4001) })).resolves.toEqual({
      ok: false,
      reason: 'too_long',
    })
    expect(parse).not.toHaveBeenCalled()
  })

  it('거절·파싱 실패·타임아웃', async () => {
    await expect(
      extractFromChat(fakeClient({ stop_reason: 'refusal', parsed_output: null }).client, { chat: sampleChat }),
    ).resolves.toEqual({ ok: false, reason: 'refusal' })
    await expect(
      extractFromChat(fakeClient({ stop_reason: 'end_turn', parsed_output: null }).client, { chat: sampleChat }),
    ).resolves.toEqual({ ok: false, reason: 'parse_failed' })
    await expect(
      extractFromChat(
        fakeClient(async () => {
          throw new APIConnectionTimeoutError()
        }).client,
        { chat: sampleChat },
      ),
    ).resolves.toEqual({ ok: false, reason: 'timeout' })
  })
})
