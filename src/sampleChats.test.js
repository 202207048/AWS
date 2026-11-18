import { describe, expect, it } from 'vitest'
import { SAMPLE_CHATS } from './sampleChats.js'
import { SAMPLE_CHAT } from './sampleChat.js'

describe('SAMPLE_CHATS', () => {
  it('10개이고 id가 모두 다르다', () => {
    expect(SAMPLE_CHATS).toHaveLength(10)
    expect(new Set(SAMPLE_CHATS.map(({ id }) => id)).size).toBe(10)
  })

  it('제목과 대화가 비어 있지 않다', () => {
    for (const sample of SAMPLE_CHATS) {
      expect(sample.title.trim()).not.toBe('')
      expect(sample.chat.trim()).not.toBe('')
      expect(sample.chat.split('\n').length).toBeGreaterThanOrEqual(3)
    }
  })

  it('PLAN 16절 샘플 단톡을 그대로 포함한다', () => {
    expect(SAMPLE_CHATS.some(({ chat }) => chat === SAMPLE_CHAT)).toBe(true)
    expect(SAMPLE_CHAT).toBe([
      '민수: 이번 주 금요일 저녁에 밥 먹자! 다들 어디서 와?',
      '지영: 나 회사가 강남이라 강남에서 출발',
      '현우: 난 집이 수원이라 수원역',
      '서연: 나는 일산 살아 ㅠ 멀어',
      '민수: 난 잠실에서 갈게',
    ].join('\n'))
  })
})
