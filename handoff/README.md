# 팀원별 전달 파일

메신저 대신 이 폴더로 지시와 상태를 주고받습니다. **개발1이 관리하며 `main`에 올립니다.**

| 파일 | 받는 사람 |
|---|---|
| [TO_DEV1.md](TO_DEV1.md) | 개발1 (서버·Claude) |
| [TO_DEV2.md](TO_DEV2.md) | 개발2 (계산·데이터) |
| [TO_DEV3.md](TO_DEV3.md) | 개발3 (화면) |

## 읽는 법

내 브랜치에 있는 채로 최신 지시만 확인할 수 있습니다 (`main`으로 이동하거나 합칠 필요 없음).

```bash
git fetch origin
git show origin/main:handoff/TO_DEV2.md
```

Kiro에게는 이렇게 말하면 됩니다.

```text
git fetch origin 후 git show origin/main:handoff/TO_DEV2.md 내용을 읽고, 아직 안 한 항목을 위에서부터 진행해줘.
```

## 규칙

- 각 파일의 맨 위 항목이 가장 최신입니다. 항목마다 날짜·시각이 있습니다.
- 끝낸 항목은 내 브랜치에 커밋·푸시하면 개발1이 확인하고 `[완료]`로 표시합니다.
- 개발1에게 전할 말이 있으면 내 브랜치의 커밋 메시지에 `[TO_DEV1]`로 시작하는 줄을 남깁니다. 개발1이 확인합니다.
