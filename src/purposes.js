// 약속 목적(우선순위 최대 3개)과 지도 주변 장소 탭 순서.
export const PURPOSE_OPTIONS = [
  { value: '밥', emoji: '🍚' },
  { value: '카페', emoji: '☕' },
  { value: '술', emoji: '🍻' },
  { value: '공부', emoji: '📚' },
  { value: '놀거리', emoji: '🎳' },
]

export const MAX_PURPOSES = 3
export const MAX_PURPOSE_NOTE = 80

const PURPOSE_VALUES = new Set(PURPOSE_OPTIONS.map(({ value }) => value))

const CATEGORY_BY_PURPOSE = {
  밥: 'food',
  술: 'food',
  카페: 'cafe',
  공부: 'cafe',
  놀거리: 'play',
}

const ALL_CATEGORIES = ['cafe', 'food', 'play']

export function isPurpose(value) {
  return PURPOSE_VALUES.has(value)
}

/** 탭한 목적을 우선순위 목록에 넣거나 뺀다. 이미 있으면 빼고, 없으면 (3개 미만일 때) 맨 뒤에 붙인다. */
export function togglePurpose(purposes, value) {
  if (!isPurpose(value)) return purposes
  if (purposes.includes(value)) return purposes.filter((item) => item !== value)
  if (purposes.length >= MAX_PURPOSES) return purposes
  return [...purposes, value]
}

/** 추출 결과의 목적을 1순위로 올린다 (나머지는 순서 유지, 최대 3개). */
export function promotePurpose(purposes, value) {
  if (!isPurpose(value)) return purposes
  return [value, ...purposes.filter((item) => item !== value)].slice(0, MAX_PURPOSES)
}

/** 목적 우선순위 → 지도 주변 장소 탭 순서 (cafe/food/play, 중복 제거, 남은 분류는 뒤에). */
export function categoryOrderFor(purposes) {
  const order = []
  for (const purpose of purposes ?? []) {
    const category = CATEGORY_BY_PURPOSE[purpose]
    if (category && !order.includes(category)) order.push(category)
  }
  for (const category of ALL_CATEGORIES) {
    if (!order.includes(category)) order.push(category)
  }
  return order
}
