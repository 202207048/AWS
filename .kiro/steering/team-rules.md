---
inclusion: always
---

# 팀 작업 규칙 (모든 작업에 자동 적용)

이 저장소는 3명이 각자 Kiro로 동시에 작업한다. 전체 계획은 `PLAN.md`, 요약은 `OVERVIEW.md`에 있다. 이 규칙과 `PLAN.md`가 다르면 `PLAN.md`를 따른다.

## 0. 작업을 시작할 때마다 (가장 먼저)

1. `git fetch origin`
2. `git show origin/main:handoff/TO_DEVN.md` 로 내 역할의 전달 파일을 읽는다 (N은 내 역할 번호). 이 파일의 지시가 가장 최신이다.
3. 전달 파일에 "main 받기"가 있으면 `PLAN.md` 0절 4번 순서대로 `main`을 받는다.

## 1. 내 역할은 현재 브랜치로 정한다

| 브랜치 | 역할 | 수정 가능한 파일 |
|---|---|---|
| `dev1-server` | 개발1 · 서버·Claude | `server/**`, `vite.config.js`, `package.json`, `package-lock.json`, `.env.example`, `README.md` |
| `dev2-calc` | 개발2 · 계산·데이터 | `src/ranking.js`, `src/graph.js`, `src/baseline.js`, `src/stations.js`, `src/data/**`, `src/ranking.test.js`, `src/graph.test.js`, `src/baseline.test.js`, `src/data/*.test.js`, `scripts/**` |
| `dev3-ui` | 개발3 · 화면 | `src/App.jsx`, `src/styles.css`, `src/api.js`, `src/api.test.js`, `src/mockCalc.js`, `src/sampleChat.js`, `src/verdict.js`, `src/verdict.test.js` |

- 역할은 브랜치 접두어로 정한다: `dev1*`→개발1, `dev2*`→개발2, `dev3*`→개발3. 사용자가 채팅에서 "개발N"이라고 하면 그 말이 우선한다.
- 그 외 브랜치면 역할을 한 번만 묻고, 그 대화에서는 다시 묻지 않는다.
- `main`에서는 기능 코드를 고치지 않는다. `git pull`, 합치기, 충돌 해결, `npm install/test/build`는 허용한다.
- 작업 전 `PLAN.md` 4·5·7·14절(개발3은 15·16절도)을 다시 읽는다.
- `npm run dev`처럼 끝나지 않는 명령은 직접 실행하지 말고 사용자에게 부탁한다.
- 다른 역할에게 전할 말이 있으면 `handoff/TO_DEVN.md`에 적지 말고 사용자에게 알린다 (전달 파일은 개발1이 관리한다).
- **내 역할의 파일만 수정한다.** 다른 역할의 파일을 고쳐야 할 것 같으면 고치지 말고 사용자에게 알린다.
- 패키지 추가가 필요하면 개발1만 `package.json`을 수정한다. 개발2·3은 직접 설치하지 말고 사용자에게 알린다.
- `PLAN.md` 5절의 공통 약속(함수 형식, API 형식)은 바꾸지 않는다.

## 2. 작업 방식

- `PLAN.md` 7절 내 역할 표의 작업을 위에서부터 **하나씩** 한다.
- 작업 하나가 끝나면 **멈추고**, 바뀐 파일과 테스트 결과를 요약해서 사용자 검토를 기다린다.
- 커밋과 푸시는 사용자가 확인한 뒤에만 한다.

## 3. 테스트 (묻지 말고 이 기준을 따른다)

- 도구는 vitest(`npm test`). 새 테스트 도구를 추가하지 않는다.
- 테스트 파일은 대상 파일 옆에 `*.test.js`로 둔다.
- 범위는 `PLAN.md` 7절 내 작업의 "완료 기준" 항목까지만.
- 외부 네트워크·API를 호출하지 않는다. Claude 호출은 SDK mock으로 대체한다.
- 작업이 끝나면 `npm test` 결과를 보여 준다.

## 4. 실행 환경

- `node` 또는 `npm`을 찾을 수 없으면 직접 내려받아 설치하지 말고, 사용자에게 nodejs.org에서 LTS 버전을 설치한 뒤 Kiro를 재시작하라고 안내하고 멈춘다.
- `git`을 찾을 수 없으면 git-scm.com 설치 후 Kiro 재시작을 안내하고 멈춘다.

## 5. Claude API와 키

- AI는 Anthropic Claude API만 쓴다. Gemini, Bedrock 코드는 만들지 않는다.
- 키는 `.env`의 `ANTHROPIC_API_KEY`에만 두고 **서버에서만** 읽는다. `VITE_` 접두어 금지. `.env`는 절대 커밋하지 않는다.
- 호출 규칙: 모델 `claude-opus-5-5`(상수 하나), `temperature`/`top_p`/`thinking` 파라미터 금지, `output_config.effort: "low"`, `max_tokens` 약 4000, `client.messages.parse` + `zodOutputFormat`, `stop_reason`이 `end_turn`이 아니거나 `parsed_output`이 null이면 실패 처리. 나머지 규칙은 `PLAN.md` 8절.

## 6. 정직성

- AI는 숫자를 만들지 않는다. 화면과 판결문의 모든 시간은 계산 모듈의 값이다.
- 지하철 구간 데이터는 사람이 확인한 것만 `verified: true`. 화면에는 "추정치"라고 표기한다.
- 실제 데이터가 없는 기능은 만들지 않는다.
