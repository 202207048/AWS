import { APIConnectionTimeoutError } from '@anthropic-ai/sdk'
import { describe, expect, it, vi } from 'vitest'
import { allowedMinutes, CLAUDE_MODEL, generateVerdict, minutesMatch, normalizePurposes, stationLabel } from './claude.js'

describe('normalizePurposes', () => {
  it('우선순위 최대 3개, 중복·알 수 없는 값 제거, 메모의 숫자·꺾쇠 제거', () => {
    expect(
      normalizePurposes({ purposes: ['카페', '밥', '카페', '노래', '술', '공부'], purposeNote: '<b>조용한 곳</b> 30분 이내' }),
    ).toEqual({ list: ['카페', '밥', '술'], note: 'b 조용한 곳 /b 이내' })
    expect(normalizePurposes({ purpose: '밥', purposeNote: '10명 단체석' }).note).toBe('10명 단체석')
    expect(normalizePurposes({ purpose: '밥' })).toEqual({ list: ['밥'], note: '' })
  })
})

describe('stationLabel', () => {
  it('"역"을 한 번만 붙인다', () => {
    expect(stationLabel('사당')).toBe('사당역')
    expect(stationLabel('서울역')).toBe('서울역')
  })
})

const request = {
  purpose: '밥',
  mode: 'fair',
  participants: [
    { id: 1, stationName: '잠실' },
    { id: 2, stationName: '강남' },
  ],
  ranked: [
    {
      station: { name: '사당' },
      times: [
        { participantId: 1, minutes: 38.4, transfers: 0 },
        { participantId: 2, minutes: 22.2, transfers: 1 },
      ],
      maxTime: 38.4,
      minTime: 22.2,
      spread: 16.2,
      weightedScore: 31.74,
    },
  ],
}

const goodVerdict = {
  order: '이번 밥 약속 장소는 사당역으로 정한다.',
  reason: '누구도 38분을 넘기지 않고, 이동시간 차이도 16분에 그친다.',
  sentence: '전원은 사당역으로 모일 것.',
}

function fakeClient(result) {
  const parse = typeof result === 'function' ? vi.fn(result) : vi.fn().mockResolvedValue(result)
  return { client: { messages: { parse } }, parse }
}

describe('generateVerdict', () => {
  it('성공하면 claude 판결문을 돌려준다', async () => {
    const { client } = fakeClient({ stop_reason: 'end_turn', parsed_output: goodVerdict })
    await expect(generateVerdict(client, request)).resolves.toEqual({
      ok: true,
      source: 'claude',
      verdict: goodVerdict,
    })
  })

  it('PLAN.md 8절 호출 규칙을 지킨다', async () => {
    const { client, parse } = fakeClient({ stop_reason: 'end_turn', parsed_output: goodVerdict })
    await generateVerdict(client, request)
    const params = parse.mock.calls[0][0]

    expect(params.model).toBe(CLAUDE_MODEL)
    expect(params.max_tokens).toBe(4000)
    expect(params.output_config.effort).toBe('low')
    expect(params.output_config.format).toBeDefined()
    expect(params).not.toHaveProperty('temperature')
    expect(params).not.toHaveProperty('top_p')
    expect(params).not.toHaveProperty('thinking')
    expect(params.messages[0].content).toContain('사당역')
    expect(params.messages[0].content).toContain('38분')
  })

  it('거절되면 refusal', async () => {
    const { client } = fakeClient({ stop_reason: 'refusal', parsed_output: null })
    await expect(generateVerdict(client, request)).resolves.toEqual({ ok: false, reason: 'refusal' })
  })

  it('parsed_output이 없으면 parse_failed', async () => {
    const { client } = fakeClient({ stop_reason: 'end_turn', parsed_output: null })
    await expect(generateVerdict(client, request)).resolves.toEqual({
      ok: false,
      reason: 'parse_failed',
    })
  })

  it('max_tokens로 끊기면 parse_failed', async () => {
    const { client } = fakeClient({ stop_reason: 'max_tokens', parsed_output: goodVerdict })
    await expect(generateVerdict(client, request)).resolves.toEqual({
      ok: false,
      reason: 'parse_failed',
    })
  })

  it('타임아웃이면 timeout', async () => {
    const { client } = fakeClient(async () => {
      throw new APIConnectionTimeoutError()
    })
    await expect(generateVerdict(client, request)).resolves.toEqual({ ok: false, reason: 'timeout' })
  })

  it('그 밖의 오류는 error', async () => {
    const { client } = fakeClient(async () => {
      throw new Error('boom')
    })
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    await expect(generateVerdict(client, request)).resolves.toEqual({ ok: false, reason: 'error' })
  })

  it('계산값에 없는 "N분"이 있으면 number_mismatch', async () => {
    const { client } = fakeClient({
      stop_reason: 'end_turn',
      parsed_output: { ...goodVerdict, reason: '모두 99분 안에 도착한다.' },
    })
    await expect(generateVerdict(client, request)).resolves.toEqual({
      ok: false,
      reason: 'number_mismatch',
    })
  })

  it('ranked가 비어 있으면 호출하지 않고 error', async () => {
    const { client, parse } = fakeClient({ stop_reason: 'end_turn', parsed_output: goodVerdict })
    await expect(generateVerdict(client, { ...request, ranked: [] })).resolves.toEqual({
      ok: false,
      reason: 'error',
    })
    expect(parse).not.toHaveBeenCalled()
  })
})

describe('minutesMatch', () => {
  it('반올림한 계산값(38, 22, 16)은 허용한다', () => {
    expect(minutesMatch(goodVerdict, request.ranked)).toBe(true)
  })
})

describe('allowedMinutes', () => {
  it('기존 반올림 값과 화면용 시간 차이(round(max) - round(min))를 모두 허용한다', () => {
    const ranked = [
      {
        station: { name: '사당' },
        times: [
          { participantId: 1, minutes: 26.4 },
          { participantId: 2, minutes: 21.5 },
        ],
        maxTime: 26.4,
        minTime: 21.5,
        spread: 4.9,
      },
    ]
    const allowed = allowedMinutes(ranked)
    expect(allowed.has(26)).toBe(true)
    expect(allowed.has(22)).toBe(true)
    expect(allowed.has(5)).toBe(true) // round(spread)
    expect(allowed.has(4)).toBe(true) // 26 - 22
    expect(minutesMatch({ order: '', reason: '26분과 22분, 차이 4분', sentence: '' }, ranked)).toBe(true)
  })
})
