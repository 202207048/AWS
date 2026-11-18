# 개발2(계산·데이터·지도)에게

> 최신 항목이 맨 위입니다. 끝낸 항목은 `dev2-calc`에 커밋·푸시해 주세요.

---

## 2026-11-18 #2 — 2-1 검토 결과 + 지도 기능 추가 (우선순위 변경)

**검토한 커밋:** `aa3aa8a feat: align ranking calculation contract`

### 잘 된 점
- `rankStations(participants, stations, { mode = 'fair' } = {})` 생략 가능, `weightedScore`, `travelTime`, `roundedMinutes`/`straightLineDistance` export 유지 — 계약대로입니다.

### 바로 고칠 것 (2-1 마무리)
1. **`npm test` 실패 1건:** `src/ranking.test.js`의 "30개 역을 점수가 낮은 순서로 정렬한다"가 없어진 `score` 필드를 검사합니다. `weightedScore` 기준으로 바꾸고, **fair / weighted 두 모드 각각 정렬 테스트**를 추가하세요.
2. **정렬 비교를 분 단위 반올림 값으로:** `compareFair`, `compareWeighted`에서 `Math.round(a.maxTime) - Math.round(b.maxTime)`처럼 반올림 값을 비교하세요 (PLAN 5-1). 지금은 소수점까지 비교해서 두 번째 기준(편차)이 사실상 쓰이지 않습니다.

### 새 작업 순서 (시간이 부족해서 바뀜)
1. 위 2-1 마무리 → 커밋·푸시
2. **2-2 기존 방식 계산** (`src/baseline.js` + 테스트)
3. **`main` 받기 → `npm install`** (개발1이 `leaflet`, `react-leaflet`을 `main`에 올림. 아래 확인 방법 참고)
4. **4-3 지도 컴포넌트 + 4-4 주변 장소 모듈** — `PLAN.md` 17절 전체를 그대로 따를 것
5. **2-6 데모 조합 찾기 스크립트** — 현재 잠실·강남·수원·합정은 기존 방식과 판결이 **둘 다 사당역**이라 비교 장면이 안 됩니다. 결과가 갈리는 조합을 꼭 찾아 주세요.
6. 시간이 남으면 2-3~2-5 지하철 그래프 (남지 않으면 직선거리 유지)

지도 패키지가 `main`에 올라왔는지 확인:

```bash
git fetch origin
git show origin/main:package.json
```

`"leaflet"`과 `"react-leaflet"`이 보이면 3번을 진행합니다. 아직이면 4-4(`src/places.js`)부터 먼저 만들어도 됩니다 (패키지 불필요).

### Kiro에 붙여넣을 문구

```text
handoff/TO_DEV2.md(origin/main)의 2026-11-18 #2 항목대로 해줘.
"바로 고칠 것" → "새 작업 순서" 1번부터 하나씩. 지도는 PLAN.md 17절을 그대로 따르고 묻지 마.
작업 하나가 끝날 때마다 npm test 결과와 바뀐 파일을 보여주고 멈춰.
```

---

## 2026-11-18 #1 — 계획 갱신 반영 + 작업 시작

**현재 확인된 상태:** `origin/dev2-calc` 브랜치에 아직 작업 커밋이 없습니다 (`main`과 동일). 로컬에서 작업 중이면 커밋·푸시해 주세요.

### 1. main 받기

`PLAN.md` 0절 4번 순서대로 진행합니다.

```bash
git status                      # package-lock.json이 ??면 먼저 삭제
git add src/ranking.js src/ranking.test.js   # 내 담당 파일 중 바뀐 것만
git commit -m "wip: dev2"
git pull --no-rebase origin main
npm install
```

받은 뒤 Kiro에서 **새 채팅**을 시작합니다 (새 규칙 파일이 적용되도록).

### 2. 바뀐 계획 (반드시 반영)

- `rankStations(participants, stations, { mode = 'fair' } = {})`. 3번째 인자는 **생략 가능**. 인자 두 개 호출도 동작해야 함.
  - `'fair'`(기본) = 최대 시간 → 편차 순서
  - `'weighted'` = 최대×0.7 + 편차×0.3이 낮은 순서
- **정렬 비교는 분 단위 반올림 값**으로, 완전히 같으면 역 이름 가나다순.
- 모든 `StationResult`(baseline 포함)에 `weightedScore`(최대×0.7 + 편차×0.3)를 넣음. 기존 `score` 필드는 `weightedScore`로 대체.
- `roundedMinutes`, `straightLineDistance` **export 유지** (화면이 사용 중).
- 2-4 자동 점검의 정상 속도 범위: 좌표 직선거리 기준 10~120km/h.
- 2-6 스크립트는 "fair 1위 ≠ 기존 방식", "fair 1위 ≠ weighted 1위" 조합을 모두 출력.
- 예전 계획으로 만든 `.kiro/specs/**`가 있으면 지우거나 새로 만듦.

### 3. 작업 순서

`PLAN.md` 7절 개발2 표 **2-1부터** 하나씩. 테스트는 14절 기준 (묻지 말 것).

- 2-3(지하철 데이터)을 만든 뒤에는 **반드시 멈추고** 지도 앱으로 5~6개 구간의 정거장 수를 확인한 다음 `verified: true`를 표시.
- 시작 후 약 2시간까지 데이터 검증이 안 되면 직선거리 공식 유지 (2-5 생략).

### Kiro에 붙여넣을 문구

```text
handoff/TO_DEV2.md(origin/main)의 2026-11-18 #1 항목대로 해줘.
1) main 받기 → 2) 바뀐 계획 확인 → 3) PLAN.md 7절 2-1부터 하나씩.
작업 하나가 끝날 때마다 npm test 결과와 바뀐 파일을 보여주고 멈춰.
```
