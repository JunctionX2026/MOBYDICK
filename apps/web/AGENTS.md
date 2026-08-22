# 웹 작업 안내

Next.js App Router로 만드는 배포 단위예요. 조립과 표현만 담당해요.

## 구조

- 서버 컴포넌트를 기본으로 두고 상태나 이벤트가 필요한 경계에서만 `"use client"`를 써요.
- 라우트는 `src/app`에 두고 라우트 전용 컴포넌트와 훅은 그 라우트 폴더 안의 `_components`, `_hooks`에 둬요.
- 공용 UI는 `@mobydick/design-system`을 먼저 확인해요. 같은 역할의 컴포넌트를 앱에서 다시 만들지 않아요.
- 도메인 타입과 순수 로직은 `packages`에 둬요. 앱에 접합부 타입을 다시 정의하지 않아요.
- 다른 앱을 직접 import하지 않아요.

## 스타일

- 색상은 semantic 토큰만 써요. `bg-bg-*`, `text-fg-*`, `border-stroke-*` 형식이에요.
- 토큰 정의는 디자인 시스템이 소유해요. `globals.css`에 새 색상 변수를 만들지 않아요.
- `tailwind.config` 파일을 만들지 않아요. 토큰은 디자인 시스템의 `@theme`에 있어요.
- 다크 테마는 운영체제 설정(`prefers-color-scheme`)을 따라가요. 토글은 아직 스펙에 없어요.

## 라이브러리

- 훅과 유틸 컴포넌트는 `react-simplikit`에 있는지 먼저 확인해요.
- 배열과 객체 조작은 `es-toolkit`을 써요.
- 판별 유니온과 다중 조건 분기는 `ts-pattern`의 `match`로 표현하고 `exhaustive()`로 닫아요.

## 배포

Cloudflare Workers에 `@opennextjs/cloudflare`로 올려요. 워커 이름은 `mobydick-web`이에요.

- `pnpm --filter @mobydick/web preview`로 workerd에서 먼저 확인하고 `deploy`로 올려요. `next build`만으로는 워커 번들이 안 나와요.
- `export const runtime = "edge"`를 쓰지 않아요. 이 어댑터가 지원하지 않아요.
- `wrangler.jsonc`의 `main`과 `assets`는 빌드 산출 경로라서 바꾸지 않아요.
- 지금 앱은 전부 정적이라 증분 캐시(R2)와 self-reference 바인딩을 두지 않았어요. ISR이나 `revalidate`를 쓰기 시작하면 그때 추가해요.

## 검증

- `pnpm --filter @mobydick/web typecheck`
- `pnpm --filter @mobydick/web build`
- `pnpm --filter @mobydick/web preview` (워커 런타임 확인)
