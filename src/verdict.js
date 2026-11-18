// 역 이름에 "역"을 붙인다. "서울역"처럼 이미 "역"으로 끝나면 그대로 둔다.
export function stationLabel(name) {
  return name.endsWith('역') ? name : `${name}역`
}

// 출발지 표시용: 역이면 "○○역", 주소·장소 검색으로 고른 곳(kind: 'place')이면 이름 그대로.
export function originLabel(station) {
  if (!station?.name) return ''
  return station.kind === 'place' ? station.name : stationLabel(station.name)
}

// 화면에 보이는 시간 차이: 반올림해 보여 주는 최대·최소 시간의 차이와 일치시킨다.
// (ranking.js의 spread는 정렬용 원값이므로 그대로 둔다.)
export function displayGap(result) {
  return Math.round(result.maxTime) - Math.round(result.minTime)
}

export function createTemplateVerdict(result, purpose) {
  const station = stationLabel(result.station.name)
  const maxTime = Math.round(result.maxTime)
  const spread = displayGap(result)

  return {
    order: `이번 ${purpose} 약속 장소는 ${station}으로 정한다.`,
    reason: `누구도 약 ${maxTime}분을 넘기지 않고, 이동시간 차이도 약 ${spread}분에 그친다. 한 사람의 희생으로 세운 약속은 오래가지 못한다는 점도 참작했다.`,
    sentence: `전원은 이 판결에 따라 ${station}으로 모일 것.`,
  }
}
