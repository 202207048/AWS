# 개발3(화면)에게

> 최신 항목이 맨 위입니다. 끝낸 항목은 `dev3-ui`에 커밋·푸시해 주세요.

---

## 2026-11-18 #1 — 1차 작업 검토 결과 + 보완

**검토한 커밋:** `d614594 feat: 개발3 화면 흐름 및 비교 결과 구현`

### 잘 된 점

- 담당 파일만 수정. `api.js`가 `PLAN.md` 5-2 API 형식과 일치.
- `mockCalc.js`로 계산 모듈 대체 → 계획대로.
- 출발역 미확정 행이 있으면 판결 버튼 비활성, "대화 내용은 저장하지 않습니다", "추정치" 표기 모두 반영.

### 1. main 받기 (lockfile·새 규칙이 아직 없음)

`d614594`는 lockfile 커밋 이전에서 시작했습니다. `PLAN.md` 0절 4번 순서대로:

```bash
git status                      # package-lock.json이 ??면 먼저 삭제
git pull --no-rebase origin main
npm install
```

받은 뒤 Kiro에서 **새 채팅**을 시작합니다.

### 2. 보완할 것 (내 담당 파일만)

- **점수 방식 두 가지** (`PLAN.md` 5-1, 3-3)
  - `mockCalc.js`의 `rankStations(participants, stations, { mode = 'fair' } = {})` (생략 가능). 정렬은 분 단위 반올림 값, 같으면 역 이름 가나다순.
  - `StationResult`에 `weightedScore`(최대×0.7 + 편차×0.3)를 항상 넣고, `baselineStation` 결과에도 넣기.
  - 결과 위에 "판결 기준" 토글(공평 우선 / 가중 점수, 기본 공평 우선). 가중 모드에서는 점수도 표시. 공식 문구도 선택된 방식에 맞게.
  - `mode`는 `App.jsx` state(기본 `'fair'`). 토글 시 결과를 지우지 않고 다시 계산하고, 1위 역이 바뀌면 판결문을 다시 요청. `/api/verdict` 요청에 `mode`도 포함.
- **샘플 단톡** (`PLAN.md` 16절, 3-2)
  - `src/sampleChat.js`에 16절 대화를 그대로 넣고, 단톡 카드에 "예시 불러오기" 버튼 추가.
- 화면 순서가 `PLAN.md` 15절과 맞는지 확인.
- `src/api.test.js`는 개발3 담당. 화면(`App.jsx`)은 자동 테스트 대신 `npm run build` 통과 + 브라우저 확인.
- 예전 계획으로 만든 `.kiro/specs/**`가 있으면 지우거나 새로 만듦.

### 3. 서버 상태 (참고)

- 개발1의 API 서버(1-1)는 `dev1-server`에 있습니다. 아직 `main`에 합쳐지지 않아서 지금 화면에서 `/api/*`를 부르면 실패 → 템플릿 판결문으로 동작하는 게 정상입니다.

### Kiro에 붙여넣을 문구

```text
handoff/TO_DEV3.md(origin/main)의 2026-11-18 #1 항목대로 해줘.
1) main 받기 → 2) 보완할 것 순서대로.
끝나면 npm test, npm run build 결과와 바뀐 파일을 보여주고 멈춰.
```
