# 약속 장소 판사 — 3인 병렬 개선 계획

> 팀 공유용 작업 계획입니다. 세 명(개발1·개발2·개발3)이 각자 Kiro로 **동시에** 작업할 수 있도록, 담당 파일과 서로 주고받는 데이터 형식(약속)을 미리 정해 두었습니다.
>
> **상태: 제안안.** 10절 "팀이 정할 것"이 확정되면 그에 맞춰 수정합니다.

## 1. 한 줄 요약

단톡 대화를 붙여넣으면 AI가 각자의 출발역을 뽑아 주고, **계산된 근거**로 가장 공평한 역을 골라 법정 판결문 형식으로 알려 주는 웹앱.

## 2. 문제 정의

- 여러 명이 약속을 잡으면 보통 "지도상 중간쯤"으로 정하고, 그 결과 한 명만 멀리 오게 되는 일이 생긴다.
- 장소를 정하느라 단톡에서 메시지가 수십 개씩 오간다.
- 우리 앱은 **기존 방식(출발지 좌표의 평균점에서 가장 가까운 역)** 과 **우리 판결(가장 오래 걸리는 사람의 시간을 최소화한 역, 10절 권고안 기준)** 을 실제로 계산해서 나란히 보여 준다.

## 3. 현재 코드에서 바뀌는 점

| 현재 | 변경 | 이유 |
|---|---|---|
| 브라우저에서 Gemini 직접 호출 (`VITE_GEMINI_API_KEY`) | 서버에서 Claude API 호출 (`ANTHROPIC_API_KEY`) | `VITE_` 키는 브라우저 번들에 그대로 실려 누구나 볼 수 있음 |
| 백엔드 없음 | 작은 Node API 서버 추가 (`npm run dev` 하나로 함께 실행) | 키 보호. 나중에 AWS Lambda로 옮기기 쉬운 구조 |
| 판결문을 5줄로 자름 (`verdict.js:28`) | 구조화 출력(주문/판결 이유/선고 필드) | 마지막 "선고" 줄이 잘리는 문제 방지 |
| 이동시간 = 직선거리 × 2.5 + 10분 | 지하철 그래프(정거장 수 기반 추정 + 환승 5분) | 노선·환승을 반영. 직선거리 공식은 "기존 방식" 비교용으로 남김 |
| 의존성 버전 전부 `latest`, lockfile 없음 | 정확한 버전 고정 + `package-lock.json` 커밋 | 데모 당일 설치 시 새 버전 때문에 깨지는 것 방지 |
| 출발역은 드롭다운으로만 입력 | 단톡 붙여넣기로 드롭다운 미리 채우기 (수동 입력 유지) | AI가 실제 문제(조건 정리)를 해결하게 함 |
| 비교 화면 없음 | 기존 방식 vs 우리 판결 비교 | 차별점을 한눈에 보여 주는 핵심 장면 |

**유지하는 것:** 화면 디자인, 앱 이름, 법정 판결문 콘셉트, 템플릿 판결문(AI 실패 시 대체).

## 4. 역할 분담

| 담당 | 맡는 일 | 혼자 수정하는 파일 (다른 사람은 수정 금지) |
|---|---|---|
| **개발1 — 서버·Claude** | 버전 고정, API 서버, Claude 판결문·단톡 추출 | `server/**`, `vite.config.js`, `package.json`, `package-lock.json`, `.env.example`, `README.md` |
| **개발2 — 계산·데이터** | 지하철 데이터, 그래프 계산, 순위, 기존 방식 계산, 데모 조합 찾기 | `src/ranking.js`, `src/graph.js`, `src/baseline.js`, `src/stations.js`, `src/data/**`, `src/*.test.js` 중 계산 관련, `scripts/**` |
| **개발3 — 화면** | 단톡 입력 화면, 비교 화면, 판결문 표시, API 호출, 공유 메시지 | `src/App.jsx`, `src/styles.css`, `src/api.js`, `src/mockCalc.js`, `src/verdict.js`, `src/verdict.test.js` |

- 패키지 추가가 필요하면 **개발1에게 요청**한다 (`package.json` 충돌 방지).
- 남의 파일을 고쳐야 할 것 같으면 직접 고치지 말고 담당자에게 말한다.
- API 키는 **개발1(과 데모 담당자)만** 있으면 된다. 개발2·3은 키 없이 mock과 템플릿으로 개발한다.

## 5. 공통 약속 (서로 주고받는 형식)

세 명이 동시에 작업하려면 아래 형식을 **바꾸지 않는다.** 바꿔야 하면 셋이 합의하고 이 문서를 먼저 고친다.

### 5-1. 계산 모듈 (개발2가 만들고, 개발3이 사용)

```js
// src/ranking.js
travelTime(fromName, toName)        // → { minutes, transfers }  (같은 역이면 { minutes: 0, transfers: 0 })
rankStations(participants, stations) // → StationResult[]  (공평한 순서로 정렬)

// src/baseline.js
baselineStation(participants, stations) // → StationResult  (좌표 평균점에서 가장 가까운 역, 이동시간은 travelTime으로 계산)

// StationResult 형식
{
  station: { name, lat, lng },
  times: [{ participantId, minutes, transfers }],
  maxTime, minTime, spread,   // spread = maxTime - minTime
  totalTransfers
}

// participants 형식 (기존과 동일)
[{ id, station: { name, lat, lng } }]
```

- 지하철 그래프가 완성되기 전에는 `travelTime`이 기존 직선거리 공식을 쓰고 `transfers: 0`을 돌려준다. 그래서 개발3은 처음부터 이 형식으로 화면을 만들 수 있다.

### 5-2. API (개발1이 만들고, 개발3이 호출)

**`POST /api/verdict`**

```json
요청: {
  "purpose": "밥",
  "participants": [{ "id": 1, "stationName": "강남" }],
  "ranked": [StationResult, StationResult, StationResult]
}
응답 성공: { "ok": true, "source": "claude", "verdict": { "order": "...", "reason": "...", "sentence": "..." } }
응답 실패: { "ok": false, "reason": "no_key | refusal | parse_failed | timeout | number_mismatch | error" }
```

**`POST /api/extract`**

```json
요청: { "chat": "단톡 대화 원문" }
응답 성공: {
  "ok": true,
  "participants": [{ "name": "민수", "station": "강남" }, { "name": "지영", "station": null, "hint": "일산" }],
  "purpose": "밥"   // 대화에 없으면 null
}
응답 실패: { "ok": false, "reason": "..." }
```

- `station`은 30개 역 이름 중 하나이거나 `null`이다. `null`이면 화면에서 사용자가 직접 고르기 전에는 계산하지 않는다.
- 실패 응답이 오거나 서버가 꺼져 있으면, 개발3의 화면이 **브라우저 쪽 템플릿 판결문**(`src/verdict.js`의 `createTemplateVerdict`)과 수동 입력으로 계속 동작한다.

## 6. 브랜치와 합치는 순서

1. **시작 전 (개발1, 약 15분):** 의존성 버전 고정 + lockfile을 `main`에 먼저 올린다. 나머지 둘은 그동안 코드를 읽고 준비한다 (개발2: 지하철 노선 조사, 개발3: 화면 구성 스케치).
2. 각자 최신 `main`에서 브랜치를 만든다: `dev1-server`, `dev2-calc`, `dev3-ui`
3. 각자 작업 단위가 끝날 때마다 커밋하고 자기 브랜치에 푸시한다.
4. **중간 합치기 (시작 후 약 2시간):** **개발1 → 개발3 → 개발2** 순서로 `main`에 합친다. 담당 파일이 겹치지 않으므로 충돌은 거의 없어야 한다.
   - 이 순서인 이유: 개발2의 계산 결과 형식이 바뀌면 기존 화면(`App.jsx`의 점수 표시)이 깨진다. 화면(개발3)이 먼저 새 형식(`mockCalc.js`)으로 바뀐 뒤에 계산(개발2)을 합치면 `main`이 중간에 깨지지 않는다.
5. 합친 뒤 개발3이 `App.jsx`의 import를 `mockCalc.js`에서 실제 모듈(`ranking.js`, `baseline.js`)로 바꾸고, 실제 API와 연결해 끝까지 동작하는지 확인한다.
6. 남은 시간은 리허설과 버그 수정.

## 7. 담당별 작업

각 작업이 끝나면 Kiro를 멈추고 diff를 검토한 뒤 다음으로 넘어간다.

### 개발1 — 서버·Claude

| # | 작업 | 완료 기준 | 구분 |
|---|---|---|---|
| 1-0 | 의존성 버전 고정 | `latest` 없음, lockfile 커밋, `npm install` / `npm test` / `npm run build` 통과. `main`에 먼저 올림 | 필수 |
| 1-1 | API 서버 뼈대 | `server/index.js`(`node:http`) + `server/service.js`(순수 함수). Vite `/api` 프록시, `concurrently`로 `npm run dev` 하나에 함께 실행. 로컬 `.env`(`ANTHROPIC_API_KEY=` 빈칸, 커밋 안 함) 생성. `.env`가 없거나 키가 비어도 서버가 뜨고 `{ ok: false, reason: "no_key" }` 응답 | 필수 |
| 1-2 | Claude 판결문 `/api/verdict` | 8절 호출 규칙 준수. 판결문 속 "N분"이 요청의 계산값과 다르면 `number_mismatch`. 성공·거절·파싱 실패·타임아웃·숫자 불일치 mock 테스트 통과 | 필수 |
| 1-3 | 단톡 추출 `/api/extract` | 역 이름은 30개 목록(`z.enum`) 또는 null만 허용. 대화 원문은 로그에 남기지 않음. mock 테스트 통과 | 필수 |
| 1-4 | Gemini 흔적 정리 | `.env.example`, `README.md`에서 Gemini 제거, 실행 방법 갱신 | 필수 |
| 1-5 | 키 유출 점검 | `.env`에 가짜 키 `sk-ant-TEST`를 넣고 `npm run build` → `dist`에서 `sk-ant`, `ANTHROPIC`, `VITE_GEMINI` 검색 결과 없음 | 필수 |

### 개발2 — 계산·데이터

| # | 작업 | 완료 기준 | 구분 |
|---|---|---|---|
| 2-1 | 계산 모듈 형식 맞추기 | 5-1의 `travelTime` / `rankStations` / `StationResult` 형식으로 변경 (처음에는 직선거리 공식 그대로). 점수 방식 결정(10절) 반영. 기존 테스트(`ranking.test.js:8-10`, `:32`) 수정 | 필수 |
| 2-2 | 기존 방식 계산 | `src/baseline.js` + 테스트. 좌표 평균점에서 가장 가까운 역을 실제로 계산 | 필수 |
| 2-3 | 지하철 데이터 생성 후 **멈춤** | `src/data/subway.json`: 노드 = 30개 후보역 + 필요한 환승역. 간선 `{ from, to, line, stops, minutes, verified }`, `minutes = stops × 2`. 사람이 지도 앱으로 확인한 구간만 `verified: true` | 필수 |
| 2-4 | 데이터 자동 점검 | 모든 역 연결됨, 간선 양방향, 좌표로 계산한 속도가 비정상 범위가 아님을 확인하는 테스트 | 필수 |
| 2-5 | 그래프 계산으로 교체 | 다익스트라 상태를 (역, 노선)으로 두어 환승 시 +5분. 같은 역 0분 / 환승 +5분 테스트 통과. `travelTime`만 바뀌고 형식은 그대로 | 필수 |
| 2-6 | 데모 조합 찾기 | `scripts/`에 "기존 방식 결과 ≠ 우리 판결"인 출발지 조합을 찾는 스크립트. 결과 목록을 팀에 공유 | 필수 |

### 개발3 — 화면

| # | 작업 | 완료 기준 | 구분 |
|---|---|---|---|
| 3-1 | API 호출 모듈 | `src/api.js`에 `requestVerdict`, `requestExtract`. 실패·네트워크 오류 시 템플릿 판결문으로 대체. `verdict.js`는 템플릿 함수만 남기고 Gemini 코드 제거, `verdict.test.js` 갱신 | 필수 |
| 3-2 | 단톡 붙여넣기 화면 | 입력칸 + 버튼 → 드롭다운 미리 채움. `station: null`인 행은 강조하고 사용자가 고르기 전에는 판결 버튼 비활성. "대화 내용은 저장하지 않습니다" 안내 | 필수 |
| 3-3 | 결과 표 갱신 | 참여자별 시간 + 환승 횟수. 점수 칸은 "최대 N분 · 편차 M분". 공식 문구(`App.jsx:207`)를 실제 계산 방식으로 수정. "추정치" 표기 | 필수 |
| 3-4 | 기존 방식 비교 카드 | `baselineStation` 결과와 1위를 나란히: 역 이름, 최대 시간, 편차 | 필수 |
| 3-5 | 판결문 카드 | `order` / `reason` / `sentence`를 주문 / 판결 이유 / 선고로 표시. Gemini 안내 문구(`App.jsx:227`) 교체 | 필수 |
| 3-6 | 공유 메시지 복사 | 계산된 숫자로만 만든 문구를 클립보드에 복사 | 시간 남으면 |

- 개발1·2의 작업이 합쳐지기 전에는 `src/mockCalc.js`에 5-1 형식 그대로 `rankStations`, `baselineStation`의 가짜 버전을 만들어 화면을 개발한다. API는 서버가 없으면 실패 처리되어 템플릿으로 동작하므로 따로 mock이 필요 없다.

## 8. Claude API와 키 규칙

- 키는 프로젝트 루트 `.env`의 `ANTHROPIC_API_KEY=` 에 넣는다. **서버에서만 읽고, `VITE_` 접두어 금지, `.env`는 커밋 금지.**
- 키는 저장소에 올리지 말고, 실제 호출 테스트가 필요한 사람에게만 저장소 밖으로 전달한다.
- 호출 규칙 (Kiro가 옛날 방식으로 짜지 않도록 그대로 전달):
  - 공식 SDK `@anthropic-ai/sdk` + `zod`, 버전 고정
  - 모델은 `claude-opus-5-5` (상수 하나로 관리, 날짜 붙이지 않음)
  - `temperature`, `top_p`, `thinking` 파라미터를 보내지 않는다 (400 오류)
  - `output_config.effort: "low"`, `max_tokens` 약 4000 (생각 단계도 이 한도를 쓰므로 작게 잡으면 잘림)
  - `client.messages.parse` + `zodOutputFormat`으로 정해진 필드의 JSON을 받는다
  - `stop_reason`이 `end_turn`이 아니거나 `parsed_output`이 null이면 실패
  - SDK에 타임아웃(약 20초)과 재시도 횟수(0~1회)를 지정해 무대에서 오래 멈추지 않게 한다

## 9. 정직성 규칙

- **AI는 숫자를 만들지 않는다.** 판결문 속 모든 "N분"은 계산값과 일치해야 하며, 다르면 템플릿을 쓴다.
- 지하철 구간은 사람이 확인한 것만 `verified: true`로 표시하고, 화면에는 "추정치"라고 쓴다.
- 정해진 시각까지 지하철 데이터 검증이 끝나지 않으면 직선거리 공식을 유지하고, 발표에서 "실제 이동시간 기준"이라고 말하지 않는다.
- 목적(밥/카페/술/공부)은 판결문 말투에만 반영된다. "목적에 맞춰 추천"이라고 주장하지 않는다.
- 실제 데이터가 없는 기능(가게 수)은 넣지 않는다.

## 10. 팀이 정할 것 (권고안 포함)

| 항목 | 권고 |
|---|---|
| 담당자 배정 | 서버 경험이 있는 사람이 개발1, 데이터 꼼꼼한 사람이 개발2, 화면 작업이 익숙한 사람이 개발3 |
| 점수 방식 | 가중합(최대×0.7+시간차×0.3)은 사실상 "최대 − 0.3×최소"라 설명이 어렵다. **최대 시간 → 편차** 두 단계 순위 방식을 권고 |
| 지하철 데이터 컷 시각 | 시작 후 약 2시간까지 검증이 안 되면 직선거리 유지 |
| 서버 형태 | `node:http` + Vite `/api` 프록시 + `concurrently`. Express·SAM 불필요 |
| 가게 수 | 이번에는 제외 |
| AWS 배포 | 생략. 발표 자료에서 "서비스 계층을 Lambda로 옮길 수 있는 구조"로 설명 |

## 11. 데모 시나리오

1. 샘플 단톡 대화를 붙여넣는다 → 드롭다운이 채워진다.
2. 목록에 없는 출발지(예: 일산)는 비어 있고, 사용자가 직접 역을 고른다 → "최종 결정은 사람이 한다"를 보여 주는 장면.
3. "기존 방식 vs 판결" 비교 → 판결문.
4. 출발지 조합은 개발2의 스크립트(2-6)가 찾은 목록에서 고른다.

## 12. Kiro 사용법

각자 Kiro를 열고 자기 브랜치에서 아래처럼 시작한다 (`N`은 본인 번호).

```text
PLAN.md를 읽고 "개발N" 담당 작업만 해줘.
- 4절의 내 담당 파일만 수정하고, 다른 사람 담당 파일은 절대 수정하지 마.
- 5절의 공통 약속(함수 형식, API 형식)을 그대로 지켜.
- 7절 내 표의 작업을 위에서부터 하나씩 하고, 작업 하나가 끝날 때마다 멈추고 검토를 기다려.
- 패키지 추가가 필요하면 직접 설치하지 말고 알려줘.
```

## 13. 최종 점검표 (합친 뒤)

- [ ] `.env` 키가 비어 있어도 전체 흐름 동작 (템플릿 판결문 + 수동 입력)
- [ ] `npm test` 통과 (Claude 호출은 mock)
- [ ] 가짜 키로 빌드 후 `dist`에서 키 흔적 검색 결과 없음
- [ ] 의존성 버전 고정 + `package-lock.json` 커밋
- [ ] 데모 시나리오를 처음부터 끝까지 2회 이상 리허설
