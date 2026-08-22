# 앱 작업 안내

`apps/*`는 배포 단위예요. 조립과 표현만 담당하고 도메인 로직은 `packages/*`에 둬요.

## 규칙

- 앱끼리 직접 import하지 않아요. 공유가 필요하면 `packages/`로 올려요.
- 워크스페이스 이름은 `@mobydick/<디렉터리 이름>`을 사용해요.
- 새 앱을 만들면 그 폴더에 `AGENTS.md`를 만들고 루트 [`AGENTS.md`](../AGENTS.md)의 저장소 지도에 한 줄을 추가해요.
- 각 앱은 `dev`, `build`, `lint`, `typecheck`, `test` 스크립트를 제공해요. 루트 명령이 이 이름으로 전체를 실행해요.
- 환경 변수는 `.env.example`에 이름과 설명만 남기고 값은 커밋하지 않아요.

## 웹 앱 규칙

- Next.js App Router를 사용해요. 서버 컴포넌트를 기본으로 두고 필요한 경계에서만 `"use client"`를 써요.
- Tailwind CSS v4는 CSS의 `@theme`로 토큰을 정의해요. `tailwind.config` 파일을 만들지 않아요.
- 훅과 유틸 컴포넌트는 `react-simplikit`에 있는지 먼저 확인하고 없을 때만 만들어요.
- 배열과 객체 조작은 `es-toolkit`을 써요. lodash를 추가하지 않아요.
- 판별 유니온 분기는 `ts-pattern`의 `match`로 표현해요. 노드 상태와 정지 신호 분기가 여기에 해당해요.
- 라우트 전용 컴포넌트와 훅은 라우트 폴더 안의 `_components`, `_hooks`에 둬요.
- 검증되지 않은 외부 응답을 도메인 타입으로 단언하지 않아요. 스키마로 검증한 뒤 통과시켜요.
