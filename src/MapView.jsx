import { useEffect, useMemo, useState } from 'react'
import L from 'leaflet'
import { MapContainer, Marker, TileLayer, Tooltip, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import './MapView.css'
import { PLACE_CATEGORIES, fetchPlaces } from './places.js'

// 깔끔한 밝은 지도 (CARTO Voyager). 출처 표기는 지도 아래 문구로 대신한다 (라이선스상 표기 필수).
const TILE_URL = 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png'
const TILE_ATTRIBUTION = '&copy; OpenStreetMap contributors &copy; CARTO'
const DEFAULT_CATEGORY = 'cafe'
const DEFAULT_RADIUS_M = 500
// 위쪽은 판결 역 이름표, 아래쪽은 기존 방식 이름표가 잘리지 않도록 여유를 더 준다.
const FIT_PADDING = { paddingTopLeft: [36, 58], paddingBottomRight: [36, 44] }
const FIT_MAX_ZOOM = 15
const NEAR_ZOOM = 16

const SOURCE_NOTES = {
  osm: 'OpenStreetMap 기준, 일부 누락 가능',
  kakao: '카카오맵 기준',
}

// divIcon html에는 숫자·고정 문자열만 넣는다 (가게 이름 등 외부 문자열은 Tooltip으로만 표시).
const iconCache = new Map()
function cachedIcon(key, create) {
  if (!iconCache.has(key)) iconCache.set(key, create())
  return iconCache.get(key)
}

const winnerIcon = () =>
  cachedIcon('winner', () =>
    L.divIcon({
      className: 'map-view-pin map-view-pin--winner',
      html: '<span></span>',
      iconSize: [26, 26],
      iconAnchor: [13, 13],
      tooltipAnchor: [0, -14],
    }),
  )

const baselineIcon = () =>
  cachedIcon('baseline', () =>
    L.divIcon({
      className: 'map-view-pin map-view-pin--baseline',
      html: '<span></span>',
      iconSize: [32, 32],
      iconAnchor: [16, 16],
      tooltipAnchor: [0, 16],
    }),
  )

const originIcon = (label) =>
  cachedIcon(`origin:${label}`, () =>
    L.divIcon({
      className: 'map-view-pin map-view-pin--origin',
      html: `<span>${label}</span>`,
      iconSize: [label.length > 2 ? 34 : 22, 22],
      iconAnchor: [label.length > 2 ? 17 : 11, 11],
      tooltipAnchor: [0, -11],
    }),
  )

const placeIcon = (category) =>
  cachedIcon(`place:${category}`, () =>
    L.divIcon({
      className: `map-view-pin map-view-pin--place map-view-pin--${category}`,
      html: '<span></span>',
      iconSize: [12, 12],
      iconAnchor: [6, 6],
      tooltipAnchor: [0, -6],
    }),
  )

// 장소를 네이버지도·카카오맵에서 바로 열기 (출처 링크처럼 목록 오른쪽에 표시)
export function naverMapUrl(place, stationName) {
  const station = String(stationName ?? '').replace(/역$/, '')
  const query = station ? `${place.name} ${station}역` : place.name
  return `https://map.naver.com/p/search/${encodeURIComponent(query)}`
}

export function kakaoMapUrl(place) {
  // 카카오맵 공식 URL 형식: /link/map/이름,위도,경도 (해당 위치에 핀)
  const name = String(place.name).replace(/,/g, ' ')
  return `https://map.kakao.com/link/map/${encodeURIComponent(name)},${place.lat},${place.lng}`
}

// '서울역'처럼 이름이 이미 '역'으로 끝나면 다시 붙이지 않는다.
function withStationSuffix(name) {
  return name.endsWith('역') ? name : `${name}역`
}

function hasCoordinates(station) {
  return Number.isFinite(station?.lat) && Number.isFinite(station?.lng)
}

/** 같은 출발역에서 오는 사람은 한 마커로 묶어 "1·3"처럼 번호를 붙인다. */
function groupOrigins(origins) {
  const groups = new Map()
  ;(origins ?? []).forEach((origin, index) => {
    if (!hasCoordinates(origin?.station)) return
    const key = origin.station.name
    if (!groups.has(key)) groups.set(key, { station: origin.station, numbers: [] })
    groups.get(key).numbers.push(index + 1)
  })
  return [...groups.values()].map((group) => ({ ...group, label: group.numbers.join('·') }))
}

/** 지도 범위 조정. 좌표 문자열이 바뀔 때만 다시 맞춰서, 부모가 다시 그려져도 사용자가 옮긴 화면을 되돌리지 않는다. */
function FitView({ pointsKey, view, center }) {
  const map = useMap()
  const [centerLat, centerLng] = center

  useEffect(() => {
    // 애니메이션 없이 바로 맞춘다. 애니메이션 중에 다시 맞추거나 탭이 백그라운드면 확대가 중간에 멈추는 경우가 있다.
    if (view === 'near') {
      map.setView([centerLat, centerLng], NEAR_ZOOM, { animate: false })
      return
    }
    const points = JSON.parse(pointsKey)
    if (points.length === 0) return
    map.fitBounds(L.latLngBounds(points), { ...FIT_PADDING, maxZoom: FIT_MAX_ZOOM, animate: false })
  }, [map, pointsKey, view, centerLat, centerLng])

  return null
}

function MapViewContent({ winner, baseline, origins, categories, initialCategory }) {
  const winnerStation = winner.station
  const winnerName = winnerStation.name
  const showBaseline = hasCoordinates(baseline?.station) && baseline.station.name !== winnerName
  const originGroups = useMemo(() => groupOrigins(origins), [origins])

  const pointsKey = JSON.stringify([
    [winnerStation.lat, winnerStation.lng],
    ...(showBaseline ? [[baseline.station.lat, baseline.station.lng]] : []),
    ...originGroups.map(({ station }) => [station.lat, station.lng]),
  ])

  const [category, setCategory] = useState(initialCategory)
  // 판결 역이 바뀌면 "전체 보기"로 돌아간다.
  const [viewState, setViewState] = useState({ station: winnerName, view: 'all' })
  const view = viewState.station === winnerName ? viewState.view : 'all'

  const requestKey = `${winnerName}|${category}`
  const [placesState, setPlacesState] = useState({ key: null, result: null })
  const loading = placesState.key !== requestKey
  const result = loading ? null : placesState.result

  useEffect(() => {
    const controller = new AbortController()
    let cancelled = false

    fetchPlaces(winnerName, category, { signal: controller.signal }).then((response) => {
      // 역이나 분류가 빠르게 바뀌면 늦게 도착한 이전 응답은 버린다.
      if (!cancelled) setPlacesState({ key: `${winnerName}|${category}`, result: response })
    })

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [winnerName, category])

  const places = result?.ok && Array.isArray(result.places) ? result.places.filter(hasCoordinates) : []
  const failed = !loading && places.length === 0
  const sourceNote = SOURCE_NOTES[result?.source]
  const radius = Number.isFinite(result?.radius) ? result.radius : DEFAULT_RADIUS_M
  const categoryLabel = PLACE_CATEGORIES.find(({ id }) => id === category)?.label ?? ''

  function selectCategory(nextCategory) {
    setCategory(nextCategory)
    // 장소는 역 반경 500m 안에 있으므로, 사용자가 탭을 누르면 역 주변으로 확대한다.
    setViewState({ station: winnerName, view: 'near' })
  }

  function toggleView() {
    setViewState({ station: winnerName, view: view === 'near' ? 'all' : 'near' })
  }

  return (
    <section className="map-view" aria-label={`${withStationSuffix(winnerName)} 지도와 주변 장소`}>
      <div className="map-view__toolbar">
        <div className="map-view__tabs" role="tablist" aria-label="주변 장소 분류">
          {categories.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={category === id}
              className={`map-view__tab map-view__tab--${id}${category === id ? ' is-active' : ''}`}
              onClick={() => selectCategory(id)}
            >
              {label}
            </button>
          ))}
        </div>
        <button type="button" className="map-view__zoom" onClick={toggleView}>
          {view === 'near' ? '전체 보기' : '역 주변 보기'}
        </button>
      </div>

      <div className="map-view__map">
        <MapContainer
          center={[winnerStation.lat, winnerStation.lng]}
          zoom={12}
          scrollWheelZoom={false}
          attributionControl={false}
          className="map-view__leaflet"
        >
          <TileLayer url={TILE_URL} attribution={TILE_ATTRIBUTION} subdomains="abcd" />
          <FitView pointsKey={pointsKey} view={view} center={[winnerStation.lat, winnerStation.lng]} />

          {originGroups.map(({ station, label, numbers }) => (
            <Marker
              key={`origin-${station.name}`}
              position={[station.lat, station.lng]}
              icon={originIcon(label)}
              zIndexOffset={2000}
            >
              <Tooltip direction="top">
                출발 {numbers.join(', ')}번 · {station.name}
              </Tooltip>
            </Marker>
          ))}

          {showBaseline && (
            <Marker
              position={[baseline.station.lat, baseline.station.lng]}
              icon={baselineIcon()}
              zIndexOffset={-500}
            >
              <Tooltip direction="bottom" permanent className="map-view-label map-view-label--baseline">
                기존 방식 · {baseline.station.name}
              </Tooltip>
            </Marker>
          )}

          {places.map((place, index) => (
            <Marker
              key={`place-${category}-${index}-${place.name}`}
              position={[place.lat, place.lng]}
              icon={placeIcon(category)}
            >
              <Tooltip direction="top">
                {place.name}
                {Number.isFinite(place.distance) ? ` · ${place.distance}m` : ''}
              </Tooltip>
            </Marker>
          ))}

          {/* 판결 역은 장소·기존 방식 위에, 출발역 번호 아래에 둔다 (판결 역이 누군가의 출발역이면 번호가 보이도록). */}
          <Marker position={[winnerStation.lat, winnerStation.lng]} icon={winnerIcon()} zIndexOffset={1000}>
            <Tooltip direction="top" permanent className="map-view-label map-view-label--winner">
              판결 · {winnerName}
            </Tooltip>
          </Marker>
        </MapContainer>
      </div>

      <ul className="map-view__legend" aria-label="지도 범례">
        <li><span className="map-view__swatch map-view__swatch--winner" />판결 역</li>
        {showBaseline && <li><span className="map-view__swatch map-view__swatch--baseline" />기존 방식</li>}
        {originGroups.length > 0 && <li><span className="map-view__swatch map-view__swatch--origin" />출발역(번호)</li>}
        <li><span className={`map-view__swatch map-view__swatch--${category}`} />{categoryLabel}</li>
      </ul>

      <div className="map-view__places" aria-live="polite">
        {loading && <p className="map-view__status">주변 {categoryLabel} 불러오는 중…</p>}
        {failed && (
          <div className="map-view__empty">
            <img src="/images/map-empty.png" alt="" className="map-view__empty-image" />
            <p className="map-view__status">주변 장소 정보를 불러오지 못했어요</p>
          </div>
        )}
        {!loading && places.length > 0 && (
          <ol className="map-view__list">
            {places.map((place, index) => (
              <li key={`${category}-${index}-${place.name}`} className="map-view__item">
                <span className={`map-view__dot map-view__dot--${category}`} aria-hidden="true" />
                <span className="map-view__name">{place.name}</span>
                {Number.isFinite(place.distance) && <span className="map-view__distance">{place.distance}m</span>}
                <span className="map-view__links">
                  <a
                    className="map-view__link map-view__link--naver"
                    href={naverMapUrl(place, winnerName)}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="네이버지도에서 보기"
                  >
                    네이버
                  </a>
                  <a
                    className="map-view__link map-view__link--kakao"
                    href={kakaoMapUrl(place)}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="카카오맵에서 보기"
                  >
                    카카오
                  </a>
                </span>
              </li>
            ))}
          </ol>
        )}
      </div>

      <p className="map-view__note">
        {withStationSuffix(winnerName)} 반경 {radius}m
        {!loading && places.length > 0 && sourceNote ? ` · ${sourceNote}` : ''}
      </p>
      <p className="map-view__note">지도 데이터 © OpenStreetMap contributors · © CARTO</p>
    </section>
  )
}

/**
 * 판결 역 지도 + 주변 장소 (PLAN 17절).
 * props: winner(StationResult), baseline(StationResult|null), origins([{ id, station: { name, lat, lng } }]),
 *        categoryOrder(['food','cafe','play'] 등, 선택), initialCategory(선택, 기본은 categoryOrder 첫 번째 또는 cafe)
 */
export default function MapView({ winner, baseline = null, origins = [], categoryOrder, initialCategory }) {
  const orderKey = (categoryOrder ?? []).join(',')
  const categories = useMemo(() => {
    const ordered = orderKey
      .split(',')
      .map((id) => PLACE_CATEGORIES.find((item) => item.id === id))
      .filter(Boolean)
    const rest = PLACE_CATEGORIES.filter((item) => !ordered.includes(item))
    return [...new Set([...ordered, ...rest])]
  }, [orderKey])
  const startCategory = categories.some(({ id }) => id === initialCategory)
    ? initialCategory
    : orderKey
      ? categories[0].id
      : DEFAULT_CATEGORY

  if (!hasCoordinates(winner?.station)) return null
  // 목적 1순위(첫 탭)가 바뀌면 그 탭부터 다시 보여 준다.
  return (
    <MapViewContent
      key={startCategory}
      winner={winner}
      baseline={baseline}
      origins={origins}
      categories={categories}
      initialCategory={startCategory}
    />
  )
}

export { MapView }
