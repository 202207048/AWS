import { useMemo, useRef, useState } from 'react'
import { STATIONS } from './stations.js'
import { rankStations } from './ranking.js'
import { baselineStation } from './baseline.js'
import MapView from './MapView.jsx'
import { extractErrorMessage, requestExtract, requestGeocode, requestVerdict } from './api.js'
import { displayGap, originLabel, stationLabel } from './verdict.js'
import { SAMPLE_CHATS } from './sampleChats.js'
import {
  MAX_PURPOSE_NOTE,
  MAX_PURPOSES,
  PURPOSE_OPTIONS,
  categoryOrderFor,
  promotePurpose,
  togglePurpose,
} from './purposes.js'
import { DEPARTURE_BUFFER_MINUTES, departureTime } from './departure.js'

const initialParticipants = [
  { id: 1, station: STATIONS[0] },
  { id: 2, station: STATIONS[1] },
]

const MODES = [
  { value: 'fair', label: '가장 먼 사람 기준' },
  { value: 'weighted', label: '전체 균형 기준' },
]

const MODE_LABELS = { fair: '가장 먼 사람 기준', weighted: '전체 균형 기준' }

const MODE_COPY = {
  fair: {
    summary: '제일 오래 걸리는 사람의 시간이 가장 짧은 역을 골랐어요.',
    sortRule: '제일 오래 걸리는 사람의 시간이 짧은 역부터 보여 줘요. 같으면 사람 사이 시간 차이가 작은 역이 먼저예요.',
    ruling: '제일 오래 걸리는 사람의 시간이 가장 짧은 역',
  },
  weighted: {
    summary: '오래 걸리는 시간과 사람 사이 시간 차이를 함께 따져 가장 고른 역을 골랐어요.',
    sortRule: '제일 오래 걸리는 시간과 사람 사이 시간 차이를 함께 따져, 전체적으로 가장 고른 역부터 보여 줘요.',
    ruling: '오래 걸리는 시간과 시간 차이를 함께 따진 역',
  },
}

const GEOCODE_ERRORS = {
  too_short: '두 글자 이상 입력해 주세요.',
  empty: '검색 결과가 없어요. 다른 이름으로 찾아보세요.',
}

function personLabel(participant, index) {
  return participant.name ?? `참여자 ${index + 1}`
}

// 예시를 섞어서 한 바퀴 다 보여 주고, 다음 바퀴의 첫 예시가 직전 예시와 겹치지 않게 한다.
function shuffledDeck(count, avoidFirst) {
  const deck = Array.from({ length: count }, (_, index) => index)
  for (let index = deck.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1))
    ;[deck[index], deck[swap]] = [deck[swap], deck[index]]
  }
  if (deck.length > 1 && deck[0] === avoidFirst) [deck[0], deck[1]] = [deck[1], deck[0]]
  return deck
}

function toVerdictRanked(ranked) {
  return ranked.map(({ station, times, maxTime, minTime, spread, totalTransfers = 0, weightedScore }) => ({
    station,
    times: times.map(({ participantId, minutes, transfers = 0 }) => ({
      participantId,
      minutes,
      transfers,
    })),
    maxTime,
    minTime,
    spread,
    totalTransfers,
    weightedScore,
  }))
}

function createShareMessage(result, participants, purpose, meetingTime) {
  const participantLines = participants.map((participant, index) => {
    const estimate = result.times.find(({ participantId }) => participantId === participant.id)
    const departure = departureTime(meetingTime, estimate.minutes)
    return `${personLabel(participant, index)} (${originLabel(participant.station)} 출발): 약 ${Math.round(estimate.minutes)}분${departure ? ` · ${departure} 출발` : ''}`
  })

  return [
    '[약속 장소 판사]',
    `${purpose} 약속 장소: ${stationLabel(result.station.name)}${meetingTime ? ` (${meetingTime}까지)` : ''}`,
    ...participantLines,
    `가장 오래 걸리는 사람 ${Math.round(result.maxTime)}분 · 사람 사이 시간 차이 ${displayGap(result)}분`,
    `※ 이동시간은 직선거리 기반 추정치입니다.${meetingTime ? ` 출발 시각은 ${DEPARTURE_BUFFER_MINUTES}분 여유를 포함합니다.` : ''}`,
  ].join('\n')
}

async function copyText(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text)
    return
  }

  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.setAttribute('readonly', '')
  textarea.style.position = 'fixed'
  textarea.style.opacity = '0'
  document.body.appendChild(textarea)
  textarea.select()
  const copied = document.execCommand('copy')
  document.body.removeChild(textarea)
  if (!copied) throw new Error('클립보드 복사 실패')
}

function App() {
  const [participants, setParticipants] = useState(initialParticipants)
  const [purposes, setPurposes] = useState(['밥'])
  const [purposeNote, setPurposeNote] = useState('')
  const [meetingTime, setMeetingTime] = useState('')
  const [mode, setMode] = useState('fair')
  const [chat, setChat] = useState('')
  const [sample, setSample] = useState(null)
  const [extractStatus, setExtractStatus] = useState(null)
  const [isExtracting, setIsExtracting] = useState(false)
  // 참여자별 주소 검색 상태: { [id]: { open, query, loading, results, message } }
  const [searches, setSearches] = useState({})
  const [results, setResults] = useState([])
  const [baselineResult, setBaselineResult] = useState(null)
  const [verdict, setVerdict] = useState(null)
  const [copyStatus, setCopyStatus] = useState(null)
  const [isJudging, setIsJudging] = useState(false)
  const nextId = useRef(3)
  const extractionVersion = useRef(0)
  const latestSearchQuery = useRef({})
  const calculationVersion = useRef(0)
  const sampleDeck = useRef([])
  const lastSampleIndex = useRef(null)
  const hasUnresolvedStation = participants.some((participant) => !participant.station)
  const purpose = purposes[0] ?? '밥'

  // 지도(MapView, PLAN 17절)에 넘길 데이터
  const winnerResult = results[0] ?? null
  const participantsWithStation = useMemo(
    () => participants
      .filter((participant) => participant.station)
      .map(({ id, station }) => ({ id, station })),
    [participants],
  )
  const modeCopy = MODE_COPY[mode]
  const categoryOrder = useMemo(() => categoryOrderFor(purposes), [purposes])

  // 두 기준의 1위를 함께 계산해 결과가 다르면 알려 준다 (API 호출 없음).
  const modeWinners = useMemo(() => {
    if (!winnerResult) return null
    return {
      fair: rankStations(participantsWithStation, STATIONS, { mode: 'fair' })[0]?.station.name,
      weighted: rankStations(participantsWithStation, STATIONS, { mode: 'weighted' })[0]?.station.name,
    }
  }, [winnerResult, participantsWithStation])

  const departures = useMemo(() => {
    if (!winnerResult || !meetingTime) return []
    return participants.map((participant, index) => {
      const estimate = winnerResult.times.find(({ participantId }) => participantId === participant.id)
      return {
        id: participant.id,
        label: personLabel(participant, index),
        number: index + 1,
        minutes: estimate ? Math.round(estimate.minutes) : null,
        time: estimate ? departureTime(meetingTime, estimate.minutes) : null,
      }
    })
  }, [winnerResult, meetingTime, participants])
  const departureById = new Map(departures.map((item) => [item.id, item.time]))

  const invalidateResults = () => {
    calculationVersion.current += 1
    setResults([])
    setBaselineResult(null)
    setVerdict(null)
    setCopyStatus(null)
    setIsJudging(false)
  }

  // 사람이 출발지를 직접 바꾸면 진행 중인 AI 정리 결과가 나중에 덮어쓰지 않도록 취소한다
  const cancelExtraction = () => {
    extractionVersion.current += 1
    setIsExtracting(false)
  }

  const setStation = (id, station) => {
    cancelExtraction()
    setExtractStatus(null)
    setParticipants((current) =>
      current.map((participant) =>
        participant.id === id ? { ...participant, station, hint: null, autoFrom: null } : participant,
      ),
    )
    invalidateResults()
  }

  const updateStation = (id, stationName) => {
    setStation(id, STATIONS.find((station) => station.name === stationName) ?? null)
  }

  const updateSearch = (id, patch) => {
    setSearches((current) => ({ ...current, [id]: { ...current[id], ...patch } }))
  }

  const openSearch = (id, query = '') => {
    updateSearch(id, { open: true, query: searches[id]?.query || query, results: null, message: null, loading: false })
  }

  const closeSearch = (id) => {
    updateSearch(id, { open: false, results: null, message: null, loading: false })
  }

  const runSearch = async (id, rawQuery) => {
    const query = String(rawQuery ?? '').trim()
    if (!query) {
      updateSearch(id, { open: true, message: '찾을 주소나 장소 이름을 입력해 주세요.', results: null })
      return
    }
    latestSearchQuery.current[id] = query
    updateSearch(id, { open: true, query, loading: true, message: null, results: null })
    const response = await requestGeocode(query)
    // 그사이 다른 검색어로 바꿨다면 늦게 온 결과는 버린다
    if (latestSearchQuery.current[id] !== undefined && latestSearchQuery.current[id] !== query) return
    if (response.ok && response.results.length > 0) {
      updateSearch(id, { loading: false, results: response.results, source: response.source })
    } else {
      updateSearch(id, {
        loading: false,
        results: null,
        message: response.ok
          ? GEOCODE_ERRORS.empty
          : GEOCODE_ERRORS[response.reason] ?? '지금은 주소 검색을 쓸 수 없어요. 역 목록에서 골라 주세요.',
      })
    }
  }

  const choosePlace = (id, place) => {
    setStation(id, {
      name: place.name,
      lat: place.lat,
      lng: place.lng,
      kind: 'place',
      address: place.address ?? null,
    })
    closeSearch(id)
  }

  const addParticipant = () => {
    if (participants.length >= 6) return
    cancelExtraction()
    const id = nextId.current++
    setParticipants((current) => [...current, { id, station: null }])
    invalidateResults()
  }

  const removeParticipant = (id) => {
    if (participants.length <= 2) return
    cancelExtraction()
    setParticipants((current) => current.filter((participant) => participant.id !== id))
    invalidateResults()
  }

  const tapPurpose = (value) => {
    const next = togglePurpose(purposes, value)
    if (next.length === 0 || next === purposes) return
    setPurposes(next)
    invalidateResults()
  }

  const loadSampleChat = () => {
    if (sampleDeck.current.length === 0) {
      sampleDeck.current = shuffledDeck(SAMPLE_CHATS.length, lastSampleIndex.current)
    }
    const index = sampleDeck.current.shift()
    lastSampleIndex.current = index
    setChat(SAMPLE_CHATS[index].chat)
    setSample({ number: index + 1, title: SAMPLE_CHATS[index].title, chat: SAMPLE_CHATS[index].chat })
    setExtractStatus(null)
  }

  const extractChat = async () => {
    const trimmedChat = chat.trim()
    if (!trimmedChat || isExtracting) return

    const version = extractionVersion.current + 1
    extractionVersion.current = version
    setIsExtracting(true)
    setExtractStatus(null)

    const response = await requestExtract({ chat: trimmedChat })
    if (extractionVersion.current !== version) return

    setIsExtracting(false)
    if (!response.ok || !Array.isArray(response.participants) || response.participants.length === 0) {
      setExtractStatus({
        type: 'error',
        message: response.ok
          ? '대화에서 참여자를 찾지 못했어요. 직접 선택해 주세요.'
          : extractErrorMessage(response.reason),
      })
      return
    }

    const extractedParticipants = response.participants.slice(0, 6).map((item, index) => ({
      id: nextId.current++,
      name: typeof item.name === 'string' && item.name.trim() ? item.name.trim() : `참여자 ${index + 1}`,
      station: STATIONS.find((station) => station.name === item.station) ?? null,
      hint: typeof item.hint === 'string' && item.hint.trim() ? item.hint.trim() : null,
    }))

    while (extractedParticipants.length < 2) {
      extractedParticipants.push({ id: nextId.current++, station: null })
    }

    setParticipants(extractedParticipants)
    // 힌트가 있는 행은 검색칸에 힌트를 미리 넣어 둔다 (검색은 사용자가 누를 때만).
    setSearches(Object.fromEntries(
      extractedParticipants
        .filter((participant) => !participant.station && participant.hint)
        .map((participant) => [participant.id, { open: false, query: participant.hint }]),
    ))
    setPurposes((current) => promotePurpose(current, response.purpose))
    invalidateResults()

    // 목록에 없는 지명(예: 김포)은 바로 검색해 첫 결과를 출발지로 자동 선택한다. 사용자가 언제든 바꿀 수 있다.
    let autoCount = 0
    for (const participant of extractedParticipants.filter((item) => !item.station && item.hint)) {
      const geo = await requestGeocode(participant.hint)
      if (extractionVersion.current !== version) return
      const place = geo.ok ? geo.results?.[0] : null
      if (!place) continue
      autoCount += 1
      setParticipants((current) =>
        current.map((item) =>
          item.id === participant.id && !item.station
            ? {
                ...item,
                station: { name: place.name, lat: place.lat, lng: place.lng, kind: 'place', address: place.address ?? null },
                autoFrom: participant.hint,
              }
            : item,
        ),
      )
    }

    const unresolvedCount = extractedParticipants.filter((participant) => !participant.station).length - autoCount
    setExtractStatus({
      type: unresolvedCount > 0 || autoCount > 0 ? 'warning' : 'success',
      message: unresolvedCount > 0
        ? `${extractedParticipants.length}명을 찾았습니다. 표시된 ${unresolvedCount}명의 출발지를 역 목록이나 주소 검색으로 골라 주세요.`
        : autoCount > 0
          ? `${extractedParticipants.length}명의 출발지를 채웠습니다. 목록에 없던 ${autoCount}곳은 검색 결과로 자동 선택했으니 확인해 주세요.`
          : `${extractedParticipants.length}명의 출발역을 채웠습니다. 아래에서 결과를 확인해 주세요.`,
    })
  }

  // 판결문 요청. 더 새로운 계산이 시작되면(calculationVersion 증가) 늦게 온 응답은 버린다.
  const fetchVerdict = async (ranked, verdictMode) => {
    const version = calculationVersion.current + 1
    calculationVersion.current = version
    setVerdict(null)
    setCopyStatus(null)
    setIsJudging(true)

    const generated = await requestVerdict({
      purpose,
      purposes,
      purposeNote,
      mode: verdictMode,
      participants: participantsWithStation.map(({ id, station }) => ({ id, stationName: station.name })),
      ranked: toVerdictRanked(ranked),
    })

    if (calculationVersion.current === version) {
      setVerdict(generated)
      setIsJudging(false)
    }
  }

  const judgeMeetingPlace = () => {
    if (hasUnresolvedStation) return

    const ranked = rankStations(participantsWithStation, STATIONS, { mode }).slice(0, 3)
    setResults(ranked)
    setBaselineResult(baselineStation(participantsWithStation, STATIONS))
    fetchVerdict(ranked, mode)
  }

  // 판결 기준 토글: 결과를 지우지 않고 다시 정렬하고, 1위 역이 바뀔 때만 판결문을 다시 요청한다.
  const changeMode = (nextMode) => {
    if (nextMode === mode) return
    setMode(nextMode)
    if (!winnerResult) return

    const ranked = rankStations(participantsWithStation, STATIONS, { mode: nextMode }).slice(0, 3)
    const winnerChanged = ranked[0]?.station.name !== winnerResult.station.name
    setResults(ranked)
    if (winnerChanged) fetchVerdict(ranked, nextMode)
  }

  const copyShareMessage = async () => {
    if (!winnerResult) return

    try {
      await copyText(createShareMessage(winnerResult, participants, purpose, meetingTime))
      setCopyStatus('copied')
    } catch {
      setCopyStatus('error')
    }
  }

  const renderOriginField = (participant, index) => {
    const search = searches[participant.id] ?? {}
    const label = personLabel(participant, index)
    const isPlace = participant.station?.kind === 'place'

    if (isPlace) {
      return (
        <div className="place-chip">
          <span className="place-chip__name">
            <span aria-hidden="true">📍</span> {participant.station.name}
          </span>
          {participant.station.address && <small>{participant.station.address}</small>}
          <button
            type="button"
            className="place-chip__clear"
            onClick={() => setStation(participant.id, null)}
            aria-label={`${label} 출발지 지우기`}
          >
            ×
          </button>
        </div>
      )
    }

    if (search.open) {
      return (
        <div className="origin-search">
          <form
            className="origin-search__form"
            onSubmit={(event) => {
              event.preventDefault()
              runSearch(participant.id, search.query)
            }}
          >
            <label className="sr-only" htmlFor={`search-${participant.id}`}>{label} 출발 주소·장소 검색</label>
            <input
              id={`search-${participant.id}`}
              type="search"
              value={search.query ?? ''}
              onChange={(event) => updateSearch(participant.id, { query: event.target.value })}
              placeholder="예: 일산 주엽역, 분당 정자동"
              enterKeyHint="search"
              autoComplete="off"
            />
            <button type="submit" className="origin-search__submit" disabled={search.loading}>
              {search.loading ? '검색 중…' : '검색'}
            </button>
          </form>
          {search.message && <p className="origin-search__message">{search.message}</p>}
          {search.results && (
            <ul className="origin-search__results" aria-label="검색 결과">
              {search.results.map((place, placeIndex) => (
                <li key={`${place.name}-${place.lat}-${place.lng}-${placeIndex}`}>
                  <button type="button" onClick={() => choosePlace(participant.id, place)}>
                    <strong>{place.name}</strong>
                    {place.address && <small>{place.address}</small>}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {search.results && (
            <p className="origin-search__source">
              {search.source === 'kakao' ? '카카오맵 검색' : 'OpenStreetMap 검색'} · 이동시간은 직선거리로 추정해요
            </p>
          )}
          <button type="button" className="origin-toggle" onClick={() => closeSearch(participant.id)}>
            역 목록에서 고르기
          </button>
        </div>
      )
    }

    return (
      <>
        <label className="sr-only" htmlFor={`station-${participant.id}`}>
          {label} 출발역
        </label>
        <select
          id={`station-${participant.id}`}
          value={participant.station?.name ?? ''}
          onChange={(event) => updateStation(participant.id, event.target.value)}
          aria-invalid={!participant.station}
        >
          <option value="" disabled>출발역을 선택하세요</option>
          {STATIONS.map((station) => (
            <option key={station.name} value={station.name}>{stationLabel(station.name)}</option>
          ))}
        </select>
        {participant.station && participant.autoFrom && (
          <span className="station-auto">
            “{participant.autoFrom}”을(를) 검색해 ‘{participant.station.name}’(으)로 자동 선택했어요. 다르면 바꿔 주세요.
          </span>
        )}
        {!participant.station && (
          <span className="station-warning">
            {participant.hint
              ? `“${participant.hint}”은(는) 후보역 목록에 없어요. 역을 고르거나 주소로 찾아 주세요.`
              : '판결 전에 출발역을 선택해 주세요.'}
          </span>
        )}
        <div className="origin-actions">
          {!participant.station && participant.hint && (
            <button
              type="button"
              className="origin-hint-search"
              onClick={() => runSearch(participant.id, search.query || participant.hint)}
            >
              “{search.query || participant.hint}” 검색
            </button>
          )}
          <button type="button" className="origin-toggle" onClick={() => openSearch(participant.id, participant.hint ?? '')}>
            주소·장소로 찾기
          </button>
        </div>
      </>
    )
  }

  return (
    <main className="app-shell">
      <header className="hero">
        <div className="court-mark" aria-hidden="true">⚖</div>
        <p className="eyebrow">모두의 이동 시간을 공정하게</p>
        <h1>약속 장소 판사</h1>
        <p className="hero-copy">거리와 형평성을 따져 가장 공평한 역을 판결합니다.</p>
      </header>

      <section className="panel chat-panel" aria-labelledby="chat-title">
        <div className="section-heading">
          <div>
            <h2 id="chat-title">단톡으로 한 번에 입력</h2>
          </div>
          <span className="ai-badge">AI 정리</span>
        </div>
        <p className="chat-description">출발지와 약속 목적이 담긴 대화를 그대로 붙여넣으세요.</p>
        <label className="sr-only" htmlFor="chat-input">단체 대화 내용</label>
        <textarea
          id="chat-input"
          value={chat}
          onChange={(event) => setChat(event.target.value)}
          placeholder={'민수: 나는 강남에서 출발해\n지영: 난 홍대입구! 저녁 먹자'}
          rows="5"
        />
        <div className="privacy-note">
          <span aria-hidden="true">🔒</span>
          대화 내용은 저장하지 않습니다.
          {sample && sample.chat === chat && (
            <span className="sample-caption">예시 {sample.number}/{SAMPLE_CHATS.length} · {sample.title}</span>
          )}
        </div>
        <div className="chat-actions">
          <button
            className="sample-button"
            type="button"
            onClick={loadSampleChat}
            disabled={isExtracting}
          >
            {sample ? '다른 예시' : '예시 불러오기'}
          </button>
          <button
            className="extract-button"
            type="button"
            onClick={extractChat}
            disabled={!chat.trim() || isExtracting}
          >
            {isExtracting ? '대화 정리 중…' : '출발역 채우기'}
          </button>
        </div>
        {extractStatus && (
          <p className={`extract-status ${extractStatus.type}`} role="status">
            {extractStatus.message}
          </p>
        )}
      </section>

      <section className="panel input-panel" aria-labelledby="participants-title">
        <div className="section-heading">
          <div>
            <span className="step">01</span>
            <h2 id="participants-title">누가 어디서 오나요?</h2>
          </div>
          <span className="count">{participants.length} / 6명</span>
        </div>

        <div className="participant-list">
          {participants.map((participant, index) => (
            <div
              className={`participant-row ${participant.station ? '' : 'needs-station'}`}
              key={participant.id}
            >
              <span className="person-badge" aria-hidden="true">{index + 1}</span>
              <div className="participant-field">
                {participant.name && <span className="person-name">{participant.name}</span>}
                {renderOriginField(participant, index)}
              </div>
              <button
                className="remove-button"
                type="button"
                onClick={() => removeParticipant(participant.id)}
                disabled={participants.length <= 2}
                aria-label={`${personLabel(participant, index)} 삭제`}
                title={participants.length <= 2 ? '최소 2명이 필요합니다' : '참여자 삭제'}
              >
                ×
              </button>
            </div>
          ))}
        </div>

        <button
          className="add-button"
          type="button"
          onClick={addParticipant}
          disabled={participants.length >= 6}
        >
          <span aria-hidden="true">＋</span>
          {participants.length >= 6 ? '최대 6명까지 가능해요' : '참여자 직접 추가'}
        </button>
      </section>

      <section className="panel" aria-labelledby="purpose-title">
        <div className="section-heading">
          <div>
            <span className="step">02</span>
            <h2 id="purpose-title">이번 약속의 목적은?</h2>
          </div>
          <span className="count">최대 {MAX_PURPOSES}개 · 누른 순서</span>
        </div>
        <div className="purpose-grid">
          {PURPOSE_OPTIONS.map((item) => {
            const rank = purposes.indexOf(item.value)
            return (
              <button
                className={`purpose-button ${rank >= 0 ? 'selected' : ''}`}
                type="button"
                key={item.value}
                onClick={() => tapPurpose(item.value)}
                aria-pressed={rank >= 0}
                aria-label={rank >= 0 ? `${item.value} (${rank + 1}순위)` : item.value}
              >
                {rank >= 0 && <span className="purpose-rank" aria-hidden="true">{rank + 1}</span>}
                {item.value}
              </button>
            )
          })}
        </div>
        <label className="purpose-note-field" htmlFor="purpose-note">
          <span>추가 이유 (선택)</span>
          <input
            id="purpose-note"
            type="text"
            value={purposeNote}
            maxLength={MAX_PURPOSE_NOTE}
            onChange={(event) => setPurposeNote(event.target.value.slice(0, MAX_PURPOSE_NOTE))}
            placeholder="예: 조용히 얘기할 수 있는 곳"
          />
          <small>{purposeNote.length}/{MAX_PURPOSE_NOTE}</small>
        </label>
        <p className="purpose-honesty">목적은 판결문과 주변 장소 순서에 반영돼요. 역 순위 계산에는 쓰지 않아요.</p>

        <label className="meeting-time-field" htmlFor="meeting-time">
          <span>몇 시까지 모일까요? (선택)</span>
          <input
            id="meeting-time"
            type="time"
            value={meetingTime}
            onChange={(event) => setMeetingTime(event.target.value)}
          />
          {meetingTime && (
            <button type="button" className="origin-toggle" onClick={() => setMeetingTime('')}>지우기</button>
          )}
        </label>
      </section>

      <button
        className="judge-button"
        type="button"
        onClick={judgeMeetingPlace}
        disabled={isJudging || hasUnresolvedStation}
        title={hasUnresolvedStation ? '모든 참여자의 출발지를 선택해 주세요' : undefined}
      >
        <span aria-hidden="true">⚖</span>
        {isJudging
          ? '판결문 작성 중…'
          : hasUnresolvedStation
            ? '출발지를 모두 선택해 주세요'
            : '공평한 장소 판결하기'}
      </button>

      {winnerResult && (
        <section className="results" aria-live="polite">
          <div className="result-title">
            <span className="step">03</span>
            <h2>판결 결과</h2>
            <span className="estimate-badge">추정치</span>
            <p>{modeCopy.summary}</p>
          </div>

          <div className="mode-toggle-row">
            <span className="mode-toggle-label" id="mode-label">판결 기준</span>
            <div className="mode-toggle" role="group" aria-labelledby="mode-label">
              {MODES.map((item) => (
                <button
                  className={`mode-button ${mode === item.value ? 'selected' : ''}`}
                  type="button"
                  key={item.value}
                  onClick={() => changeMode(item.value)}
                  aria-pressed={mode === item.value}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
          <div className="mode-explainer">
            <p><strong>가장 먼 사람 기준</strong> · 아무도 너무 멀리 오지 않게</p>
            <p><strong>전체 균형 기준</strong> · 다 같이 비슷하게 오도록 (대신 모두 조금 더 걸릴 수 있어요)</p>
            {modeWinners && modeWinners.fair !== modeWinners.weighted && (
              <p className="mode-diff">
                이번에는 기준에 따라 결과가 달라요 · {MODE_LABELS.fair} {modeWinners.fair} / {MODE_LABELS.weighted} {modeWinners.weighted}
              </p>
            )}
          </div>

          {/* 지도를 결과 맨 위에 두어 "누가 어디서 몇 분"을 먼저 보여 준다 */}
          {winnerResult && (
            <MapView
              winner={winnerResult}
              baseline={baselineResult}
              origins={participantsWithStation}
              categoryOrder={categoryOrder}
            />
          )}

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>순위</th>
                  <th>후보역</th>
                  {participants.map((participant, index) => (
                    <th key={participant.id}>
                      {personLabel(participant, index)}
                      <small>{originLabel(participant.station)} 출발</small>
                    </th>
                  ))}
                  <th>가장 오래 · 시간 차이</th>
                </tr>
              </thead>
              <tbody>
                {results.map((result, rank) => (
                  <tr className={rank === 0 ? 'winner-row' : ''} key={result.station.name}>
                    <td><span className={`rank rank-${rank + 1}`}>{rank + 1}</span></td>
                    <td className="station-cell">{stationLabel(result.station.name)}</td>
                    {result.times.map(({ participantId, minutes, transfers }) => (
                      <td className="time-cell" key={participantId}>
                        약 {Math.round(minutes)}분
                        {transfers > 0 && <small>환승 {transfers}회</small>}
                        {rank === 0 && departureById.get(participantId) && (
                          <small className="departure-inline">{departureById.get(participantId)} 출발</small>
                        )}
                      </td>
                    ))}
                    <td className="criteria-cell">
                      <strong>{Math.round(result.maxTime)}분 · 차이 {displayGap(result)}분</strong>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="formula-note">
            이동시간은 같은 역 0분, 그 외 직선거리 × 2.5분 + 기본 10분으로 계산한 추정치입니다.
            {' '}{modeCopy.sortRule}
          </p>

          {baselineResult && (
            <section className="comparison" aria-labelledby="comparison-title">
              <div className="comparison-heading">
                <div>
                  <span className="comparison-kicker">WHY THIS PLACE?</span>
                  <h3 id="comparison-title">기존 방식과 비교</h3>
                </div>
                <p>같은 이동시간 추정치로 비교했어요.</p>
              </div>
              <div className="comparison-grid">
                <article className="comparison-card baseline-card">
                  <span className="method-label">기존 방식</span>
                  <h4>{stationLabel(baselineResult.station.name)}</h4>
                  <p>출발 좌표의 평균점에서 가장 가까운 역</p>
                  <dl>
                    <div>
                      <dt>가장 오래</dt>
                      <dd>{Math.round(baselineResult.maxTime)}분</dd>
                    </div>
                    <div>
                      <dt>시간 차이</dt>
                      <dd>{displayGap(baselineResult)}분</dd>
                    </div>
                  </dl>
                </article>
                <article className="comparison-card ruling-card">
                  <span className="method-label">우리 판결</span>
                  <span className="recommended-badge">추천</span>
                  <h4>{stationLabel(winnerResult.station.name)}</h4>
                  <p>{modeCopy.ruling}</p>
                  <dl>
                    <div>
                      <dt>가장 오래</dt>
                      <dd>{Math.round(winnerResult.maxTime)}분</dd>
                    </div>
                    <div>
                      <dt>시간 차이</dt>
                      <dd>{displayGap(winnerResult)}분</dd>
                    </div>
                  </dl>
                </article>
              </div>
              {departures.length > 0 && (
                <div className="departure-list">
                  <h4>
                    각자 출발 시각 ({DEPARTURE_BUFFER_MINUTES}분 여유 포함)
                    <span className="estimate-badge">추정치</span>
                  </h4>
                  <p>{stationLabel(winnerResult.station.name)}에 {meetingTime}까지 도착하려면</p>
                  <ul>
                    {departures.map((item) => (
                      <li key={item.id}>
                        <span>{item.number}번 · {item.label}</span>
                        <strong>{item.time ?? '-'} 출발</strong>
                        {item.minutes !== null && <small>약 {item.minutes}분</small>}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
          )}

          <article className="verdict-card">
            <div className="verdict-header">
              <div>
                <span className="stamp">최종 판결</span>
                <h2>{stationLabel(winnerResult.station.name)}</h2>
              </div>
              <span className="gavel" aria-hidden="true">🔨</span>
            </div>
            <div className="seal-line"><span>MEETING COURT</span></div>
            {isJudging ? (
              <div className="verdict-loading" role="status">
                <span className="loading-dot" /> 판결문을 작성하고 있습니다…
              </div>
            ) : verdict && (
              <>
                <div className="verdict-sections">
                  <section>
                    <h3>주문</h3>
                    <p>{verdict.verdict.order}</p>
                  </section>
                  <section>
                    <h3>판결 이유</h3>
                    <p>{verdict.verdict.reason}</p>
                  </section>
                  <section>
                    <h3>선고</h3>
                    <p>{verdict.verdict.sentence}</p>
                  </section>
                </div>
                <p className="source-note">
                  {verdict.source === 'claude'
                    ? 'Claude 작성 · 표시된 숫자는 계산 결과를 바탕으로 합니다.'
                    : '기본 판결문 · AI 서버를 사용할 수 없어 템플릿으로 표시했습니다.'}
                </p>
                <div className="share-actions">
                  <button className="share-button" type="button" onClick={copyShareMessage}>
                    <span aria-hidden="true">▣</span>
                    판결 결과 복사
                  </button>
                  {copyStatus && (
                    <p className={`copy-status ${copyStatus}`} role="status">
                      {copyStatus === 'copied'
                        ? '클립보드에 복사했습니다.'
                        : '복사하지 못했습니다. 브라우저 권한을 확인해 주세요.'}
                    </p>
                  )}
                </div>
              </>
            )}
          </article>
        </section>
      )}

      <footer>실제 이동시간은 노선과 교통 상황에 따라 달라질 수 있습니다.</footer>
    </main>
  )
}

export default App
