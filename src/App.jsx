import { useRef, useState } from 'react'
import { PURPOSES, STATIONS } from './stations.js'
import { rankStations, roundedMinutes } from './ranking.js'
import { generateVerdict } from './verdict.js'

const initialParticipants = [
  { id: 1, station: STATIONS[0] },
  { id: 2, station: STATIONS[1] },
]

function App() {
  const [participants, setParticipants] = useState(initialParticipants)
  const [purpose, setPurpose] = useState('밥')
  const [results, setResults] = useState([])
  const [verdict, setVerdict] = useState(null)
  const [isJudging, setIsJudging] = useState(false)
  const nextId = useRef(3)
  const calculationVersion = useRef(0)

  const invalidateResults = () => {
    calculationVersion.current += 1
    setResults([])
    setVerdict(null)
    setIsJudging(false)
  }

  const updateStation = (id, stationName) => {
    setParticipants((current) =>
      current.map((participant) =>
        participant.id === id
          ? { ...participant, station: STATIONS.find((station) => station.name === stationName) }
          : participant,
      ),
    )
    invalidateResults()
  }

  const addParticipant = () => {
    if (participants.length >= 6) return
    const id = nextId.current++
    setParticipants((current) => [
      ...current,
      { id, station: STATIONS[(current.length * 4) % STATIONS.length] },
    ])
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

  const judgeMeetingPlace = async () => {
    const version = calculationVersion.current + 1
    calculationVersion.current = version
    const ranked = rankStations(participants, STATIONS).slice(0, 3)

    setResults(ranked)
    setVerdict(null)
    setIsJudging(true)

    const generated = await generateVerdict(
      ranked[0],
      purpose,
      participants,
      import.meta.env.VITE_GEMINI_API_KEY,
    )

    if (calculationVersion.current === version) {
      setVerdict(generated)
      setIsJudging(false)
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
            <div className="participant-row" key={participant.id}>
              <span className="person-badge" aria-hidden="true">{index + 1}</span>
              <label className="sr-only" htmlFor={`station-${participant.id}`}>
                참여자 {index + 1} 출발역
              </label>
              <select
                id={`station-${participant.id}`}
                value={participant.station.name}
                onChange={(event) => updateStation(participant.id, event.target.value)}
              >
                {STATIONS.map((station) => (
                  <option key={station.name} value={station.name}>{station.name}역</option>
                ))}
              </select>
              <button
                className="remove-button"
                type="button"
                onClick={() => removeParticipant(participant.id)}
                disabled={participants.length <= 2}
                aria-label={`참여자 ${index + 1} 삭제`}
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
          {participants.length >= 6 ? '최대 6명까지 가능해요' : '참여자 추가'}
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

      <button className="judge-button" type="button" onClick={judgeMeetingPlace} disabled={isJudging}>
        <span aria-hidden="true">⚖</span>
        {isJudging ? '판결문 작성 중…' : '공평한 장소 판결하기'}
      </button>

      {results.length > 0 && (
        <section className="results" aria-live="polite">
          <div className="result-title">
            <span className="step">03</span>
            <h2>공평도 순위</h2>
            <p>낮은 점수일수록 이동 부담과 시간 차이가 작아요.</p>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>순위</th>
                  <th>후보역</th>
                  {participants.map((participant, index) => (
                    <th key={participant.id}>
                      참여자 {index + 1}
                      <small>{participant.station.name} 출발</small>
                    </th>
                  ))}
                  <th>공평 점수</th>
                </tr>
              </thead>
              <tbody>
                {results.map((result, rank) => (
                  <tr className={rank === 0 ? 'winner-row' : ''} key={result.station.name}>
                    <td><span className={`rank rank-${rank + 1}`}>{rank + 1}</span></td>
                    <td className="station-cell">{result.station.name}역</td>
                    {result.times.map(({ participantId, minutes }) => (
                      <td key={participantId}>약 {roundedMinutes(minutes)}분</td>
                    ))}
                    <td className="score-cell">{result.score.toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="formula-note">
            이동시간 = 직선거리 × 2.5분 + 10분 · 점수 = 최대시간 × 0.7 + 시간차 × 0.3
          </p>

          <article className="verdict-card">
            <div className="verdict-header">
              <div>
                <span className="stamp">최종 판결</span>
                <h2>{results[0].station.name}역</h2>
              </div>
              <span className="gavel" aria-hidden="true">🔨</span>
            </div>
            <div className="seal-line"><span>MEETING COURT</span></div>
            {isJudging ? (
              <div className="verdict-loading" role="status">
                <span className="loading-dot" /> 판결문을 작성하고 있습니다…
              </div>
            ) : (
              <>
                <p className="verdict-text">{verdict?.text}</p>
                {verdict?.source === 'template' && (
                  <p className="source-note">기본 판결문 · Gemini 키가 없거나 호출에 실패했습니다.</p>
                )}
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
