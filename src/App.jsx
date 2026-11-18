import { useMemo, useRef, useState } from 'react'
import { PURPOSES, STATIONS } from './stations.js'
import { baselineStation, rankStations } from './mockCalc.js'
import { extractErrorMessage, requestExtract, requestVerdict } from './api.js'
import { stationLabel } from './verdict.js'
import { SAMPLE_CHAT } from './sampleChat.js'

const initialParticipants = [
  { id: 1, station: STATIONS[0] },
  { id: 2, station: STATIONS[1] },
]

const MODES = [
  { value: 'fair', label: '공평 우선' },
  { value: 'weighted', label: '가중 점수' },
]

const MODE_COPY = {
  fair: {
    summary: '가장 오래 걸리는 사람의 시간을 먼저 줄이고, 같으면 참여자 간 편차가 작은 역을 골랐어요.',
    sortRule: '최대 이동시간이 짧은 순, 같으면 편차가 작은 순, 그래도 같으면 역 이름 순으로 정렬합니다(분 단위 반올림 기준).',
    ruling: '최대 이동시간을 줄이고 편차까지 비교한 역',
  },
  weighted: {
    summary: '최대 이동시간과 편차를 섞은 가중 점수가 가장 낮은 역을 골랐어요.',
    sortRule: '점수 = 최대 이동시간 × 0.7 + 편차 × 0.3. 점수가 낮은 순, 같으면 최대 이동시간이 짧은 순, 그래도 같으면 역 이름 순으로 정렬합니다.',
    ruling: '가중 점수(최대 × 0.7 + 편차 × 0.3)가 가장 낮은 역',
  },
}

function formatScore(score) {
  return score.toFixed(1)
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

function createShareMessage(result, participants, purpose) {
  const participantLines = participants.map((participant, index) => {
    const estimate = result.times.find(({ participantId }) => participantId === participant.id)
    const name = participant.name ?? `참여자 ${index + 1}`
    return `${name} (${stationLabel(participant.station.name)} 출발): 약 ${Math.round(estimate.minutes)}분 · 환승 ${estimate.transfers}회`
  })

  return [
    '[약속 장소 판사]',
    `${purpose} 약속 장소: ${stationLabel(result.station.name)}`,
    ...participantLines,
    `최대 ${Math.round(result.maxTime)}분 · 편차 ${Math.round(result.spread)}분`,
    '※ 이동시간과 환승 횟수는 추정치입니다.',
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
  const [purpose, setPurpose] = useState('밥')
  const [mode, setMode] = useState('fair')
  const [chat, setChat] = useState('')
  const [extractStatus, setExtractStatus] = useState(null)
  const [isExtracting, setIsExtracting] = useState(false)
  const [results, setResults] = useState([])
  const [baselineResult, setBaselineResult] = useState(null)
  const [verdict, setVerdict] = useState(null)
  const [copyStatus, setCopyStatus] = useState(null)
  const [isJudging, setIsJudging] = useState(false)
  const nextId = useRef(3)
  const extractionVersion = useRef(0)
  const calculationVersion = useRef(0)
  const hasUnresolvedStation = participants.some((participant) => !participant.station)

  // 지도(MapView, PLAN 17절)에 넘길 데이터
  const winnerResult = results[0] ?? null
  const participantsWithStation = useMemo(
    () => participants
      .filter((participant) => participant.station)
      .map(({ id, station }) => ({ id, station })),
    [participants],
  )
  const modeCopy = MODE_COPY[mode]

  const invalidateResults = () => {
    calculationVersion.current += 1
    setResults([])
    setBaselineResult(null)
    setVerdict(null)
    setCopyStatus(null)
    setIsJudging(false)
  }

  const updateStation = (id, stationName) => {
    setParticipants((current) =>
      current.map((participant) =>
        participant.id === id
          ? {
              ...participant,
              station: STATIONS.find((station) => station.name === stationName),
              hint: null,
            }
          : participant,
      ),
    )
    invalidateResults()
  }

  const addParticipant = () => {
    if (participants.length >= 6) return
    const id = nextId.current++
    setParticipants((current) => [...current, { id, station: null }])
    invalidateResults()
  }

  const removeParticipant = (id) => {
    if (participants.length <= 2) return
    setParticipants((current) => current.filter((participant) => participant.id !== id))
    invalidateResults()
  }

  const changePurpose = (nextPurpose) => {
    setPurpose(nextPurpose)
    invalidateResults()
  }

  const loadSampleChat = () => {
    setChat(SAMPLE_CHAT)
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
      hint: typeof item.hint === 'string' ? item.hint : null,
    }))

    while (extractedParticipants.length < 2) {
      extractedParticipants.push({ id: nextId.current++, station: null })
    }

    setParticipants(extractedParticipants)
    if (PURPOSES.some((item) => item.value === response.purpose)) {
      setPurpose(response.purpose)
    }
    invalidateResults()

    const unresolvedCount = extractedParticipants.filter((participant) => !participant.station).length
    setExtractStatus({
      type: unresolvedCount > 0 ? 'warning' : 'success',
      message: unresolvedCount > 0
        ? `${extractedParticipants.length}명을 찾았습니다. 표시된 ${unresolvedCount}명의 출발역을 직접 골라 주세요.`
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
      await copyText(createShareMessage(winnerResult, participants, purpose))
      setCopyStatus('copied')
    } catch {
      setCopyStatus('error')
    }
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
        </div>
        <div className="chat-actions">
          <button
            className="sample-button"
            type="button"
            onClick={loadSampleChat}
            disabled={isExtracting}
          >
            예시 불러오기
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
                <label className="sr-only" htmlFor={`station-${participant.id}`}>
                  {participant.name ?? `참여자 ${index + 1}`} 출발역
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
                {!participant.station && (
                  <span className="station-warning">
                    {participant.hint
                      ? `“${participant.hint}”에 해당하는 후보역을 직접 선택해 주세요.`
                      : '판결 전에 출발역을 선택해 주세요.'}
                  </span>
                )}
              </div>
              <button
                className="remove-button"
                type="button"
                onClick={() => removeParticipant(participant.id)}
                disabled={participants.length <= 2}
                aria-label={`${participant.name ?? `참여자 ${index + 1}`} 삭제`}
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
        </div>
        <div className="purpose-grid">
          {PURPOSES.map((item) => (
            <button
              className={`purpose-button ${purpose === item.value ? 'selected' : ''}`}
              type="button"
              key={item.value}
              onClick={() => changePurpose(item.value)}
              aria-pressed={purpose === item.value}
            >
              <span aria-hidden="true">{item.emoji}</span>
              {item.value}
            </button>
          ))}
        </div>
      </section>

      <button
        className="judge-button"
        type="button"
        onClick={judgeMeetingPlace}
        disabled={isJudging || hasUnresolvedStation}
        title={hasUnresolvedStation ? '모든 참여자의 출발역을 선택해 주세요' : undefined}
      >
        <span aria-hidden="true">⚖</span>
        {isJudging
          ? '판결문 작성 중…'
          : hasUnresolvedStation
            ? '출발역을 모두 선택해 주세요'
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

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>순위</th>
                  <th>후보역</th>
                  {participants.map((participant, index) => (
                    <th key={participant.id}>
                      {participant.name ?? `참여자 ${index + 1}`}
                      <small>{stationLabel(participant.station.name)} 출발</small>
                    </th>
                  ))}
                  <th>{mode === 'weighted' ? '가중 점수' : '최대 · 편차'}</th>
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
                        <small>환승 {transfers}회</small>
                      </td>
                    ))}
                    <td className="criteria-cell">
                      {mode === 'weighted' && (
                        <strong className="score-value">점수 {formatScore(result.weightedScore)}</strong>
                      )}
                      <strong>최대 {Math.round(result.maxTime)}분 · 편차 {Math.round(result.spread)}분</strong>
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
                      <dt>최대</dt>
                      <dd>{Math.round(baselineResult.maxTime)}분</dd>
                    </div>
                    <div>
                      <dt>편차</dt>
                      <dd>{Math.round(baselineResult.spread)}분</dd>
                    </div>
                    {mode === 'weighted' && (
                      <div>
                        <dt>점수</dt>
                        <dd>{formatScore(baselineResult.weightedScore)}</dd>
                      </div>
                    )}
                  </dl>
                </article>
                <article className="comparison-card ruling-card">
                  <span className="method-label">우리 판결</span>
                  <span className="recommended-badge">추천</span>
                  <h4>{stationLabel(winnerResult.station.name)}</h4>
                  <p>{modeCopy.ruling}</p>
                  <dl>
                    <div>
                      <dt>최대</dt>
                      <dd>{Math.round(winnerResult.maxTime)}분</dd>
                    </div>
                    <div>
                      <dt>편차</dt>
                      <dd>{Math.round(winnerResult.spread)}분</dd>
                    </div>
                    {mode === 'weighted' && (
                      <div>
                        <dt>점수</dt>
                        <dd>{formatScore(winnerResult.weightedScore)}</dd>
                      </div>
                    )}
                  </dl>
                </article>
              </div>
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

          {/* MAP_VIEW_SLOT: <MapView winner={winnerResult} baseline={baselineResult} origins={participantsWithStation} /> */}
        </section>
      )}

      <footer>실제 이동시간은 노선과 교통 상황에 따라 달라질 수 있습니다.</footer>
    </main>
  )
}

export default App
