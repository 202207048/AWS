# 이미지 생성 프롬프트 (GPT Image 등)

앱과 발표 자료에 쓸 이미지를 만들기 위한 프롬프트입니다. ChatGPT, Codex 등 이미지 생성 도구에 그대로 붙여넣으면 됩니다.
만든 파일은 아래 "저장 위치"에 넣고 커밋하면 개발1이 화면에 연결합니다.

## 공통 스타일

모든 프롬프트 끝에 붙입니다. 앱 색상(짙은 와인색 `#8e2026`, 크림색 `#f8f5ed`, 먹색 `#24211d`)과 맞추기 위한 문장입니다.

```text
Style: clean flat illustration, warm cream background (#f8f5ed), deep wine red (#8e2026) and charcoal (#24211d) accents, soft shadows, friendly and minimal, Korean young adults, no text in the image, no logos.
```

> 이미지 안에 글자를 넣지 마세요 (생성 이미지의 한글은 깨지기 쉽습니다). 글자는 슬라이드나 화면에서 따로 넣습니다.

## 1. 앱 상단 마스코트 (판사)

- 저장 위치: `public/images/judge.png` (정사각형, 512×512, 배경 투명이면 더 좋음)

```text
A cute, friendly judge character wearing a black robe, holding a small wooden gavel, standing next to a simple subway station sign icon, gentle smile, fair and calm expression, centered, simple shapes.
```

## 2. 발표 표지

- 저장 위치: `docs/slides/cover.png` (16:9, 1920×1080)

```text
Four friends coming from different directions on a stylized Seoul subway map, their routes converging fairly at one highlighted station in the middle, each route roughly the same length, a small judge gavel icon above the meeting station, wide 16:9 composition with empty space on the left for a title.
```

## 3. 문제 장면 (한 명만 멀리)

- 저장 위치: `docs/slides/problem.png` (16:9)

```text
A group chat scene shown as floating chat bubbles without text, three friends relaxed near a cafe while one friend is far away on a long subway ride looking tired, a long route line emphasizing the unfair distance, 16:9.
```

## 4. 기존 방식 vs 우리 방식

- 저장 위치: `docs/slides/compare.png` (16:9)

```text
Split-screen comparison. Left side: a map with a pin at the geographic midpoint and one very long route among four routes (unfair). Right side: the same four origins with routes of similar length meeting at a different station marked with a gavel (fair). Clear visual contrast, 16:9.
```

## 5. AI 역할 그림 (AI는 정리, 계산은 코드, 결정은 사람)

- 저장 위치: `docs/slides/ai-role.png` (16:9)

```text
Three-step flow illustration: (1) a chat window being organized into neat cards by a small friendly AI assistant, (2) a calculator and stopwatch computing travel times, (3) a person pressing a confirm button. Arrows between steps, 16:9.
```

## 6. 지도 영역 빈 상태 / 로딩

- 저장 위치: `public/images/map-empty.png` (가로 800×400)

```text
A small folded paper map with a magnifying glass and tiny cafe, restaurant and park icons around it, light and airy, plenty of empty space.
```

## 주의

- 실제 서비스·브랜드(카카오맵, 네이버, 지하철 공식 노선도 등)를 흉내 낸 이미지는 만들지 않습니다.
- 실존 인물 얼굴이나 실제 가게 간판이 들어가지 않게 합니다.
- 생성 이미지는 "AI 생성 이미지"라고 발표 자료 하단에 작게 표기합니다.
