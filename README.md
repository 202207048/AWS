# AWS

## 약속 장소 판사

단톡 대화를 붙여넣으면 AI가 출발역을 정리하고, 이동시간이 가장 공평한 약속 역을 계산해 법정 판결문 형식으로 알려 주는 모바일 우선 웹앱입니다. 전체 계획은 [PLAN.md](PLAN.md), 요약은 [OVERVIEW.md](OVERVIEW.md)를 보세요.

### 실행

Node.js LTS가 필요합니다.

```bash
npm install
npm run dev
```

`npm run dev`는 API 서버(`http://127.0.0.1:8787`)와 화면(`http://localhost:5173`)을 함께 실행합니다. 화면의 `/api` 요청은 API 서버로 전달됩니다.

### API 키 설정 (선택)

`.env.example`을 `.env`로 복사하고 키를 넣은 뒤 `npm run dev`를 다시 실행합니다.

```env
ANTHROPIC_API_KEY=발급받은_Claude_키
KAKAO_REST_API_KEY=선택_카카오_REST_키
```

- 키는 서버에서만 읽으며 브라우저 번들에 들어가지 않습니다. `.env`는 커밋하지 마세요.
- Claude 키가 없거나 호출이 실패하면 템플릿 판결문과 수동 입력으로 끝까지 동작합니다.

### API

| 경로 | 설명 |
|---|---|
| `POST /api/verdict` | 계산 결과로 Claude 판결문(주문·판결 이유·선고) 생성. 판결문 속 "N분"이 계산값과 다르면 거부 |
| `POST /api/extract` | 단톡 대화에서 참여자·출발역·목적 추출 (역 목록에 없으면 `null` + `hint`) |
| `GET /api/places?station=사당&category=cafe` | 역 반경 500m 카페(`cafe`)·음식점(`food`)·놀 곳(`play`). 실제 데이터 캐시 우선 |

주변 장소 캐시를 새로 받으려면 (OpenStreetMap은 약 4분 소요):

```bash
node server/scripts/prefetch-places.js
```

### 명령어

- `npm run dev`: API 서버 + 개발 화면
- `npm run build`: 배포용 빌드
- `npm test`: 테스트 (외부 API는 호출하지 않음)

### 데이터 출처

- 지도 타일·주변 장소: © OpenStreetMap contributors (카카오 키가 있으면 카카오맵)
- 이동시간은 추정치이며 실제 노선·교통 상황과 다를 수 있습니다.
