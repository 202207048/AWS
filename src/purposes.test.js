import { describe, expect, it } from 'vitest'
import { categoryOrderFor, promotePurpose, togglePurpose } from './purposes.js'

describe('togglePurpose', () => {
  it('탭한 순서대로 최대 3개까지 넣고, 다시 탭하면 뺀다', () => {
    let list = ['밥']
    list = togglePurpose(list, '카페')
    list = togglePurpose(list, '놀거리')
    expect(list).toEqual(['밥', '카페', '놀거리'])
    expect(togglePurpose(list, '술')).toEqual(['밥', '카페', '놀거리'])
    expect(togglePurpose(list, '밥')).toEqual(['카페', '놀거리'])
    expect(togglePurpose(list, '없는목적')).toBe(list)
  })
})

describe('promotePurpose', () => {
  it('추출된 목적을 1순위로 올린다', () => {
    expect(promotePurpose(['밥', '카페', '술'], '술')).toEqual(['술', '밥', '카페'])
    expect(promotePurpose(['밥', '카페', '술'], '공부')).toEqual(['공부', '밥', '카페'])
    expect(promotePurpose(['밥'], null)).toEqual(['밥'])
  })
})

describe('categoryOrderFor', () => {
  it('목적 우선순위대로 지도 탭 순서를 정하고 나머지를 뒤에 붙인다', () => {
    expect(categoryOrderFor(['밥'])).toEqual(['food', 'cafe', 'play'])
    expect(categoryOrderFor(['놀거리', '공부'])).toEqual(['play', 'cafe', 'food'])
    expect(categoryOrderFor(['술', '밥', '카페'])).toEqual(['food', 'cafe', 'play'])
    expect(categoryOrderFor([])).toEqual(['cafe', 'food', 'play'])
  })
})
