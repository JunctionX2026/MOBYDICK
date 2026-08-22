# 웹 작업 안내

Next.js App Router로 만드는 배포 단위예요. 조립과 표현만 담당해요.

## 구조

- 서버 컴포넌트를 기본으로 두고 상태나 이벤트가 필요한 경계에서만 `"use client"`를 써요.
- 라우트는 `src/app`에 두고 라우트 전용 컴포넌트와 훅은 그 라우트 폴더 안의 `_components`, `_hooks`에 둬요.
- 공용 UI는 `@mobydick/design-system`을 먼저 확인해요. 같은 역할의 컴포넌트를 앱에서 다시 만들지 않아요.
- 도메인 타입과 순수 로직은 `packages`에 둬요. 앱에 접합부 타입을 다시 정의하지 않아요.
- 다른 앱을 직접 import하지 않아요.
- 저장소 접근은 `src/server`에 모으고 라우트나 컴포넌트에서 D1을 직접 만지지 않아요. 읽은 행은 `@mobydick/domain`의 `parse*`로 검증해요.
- 목록은 첫 클라이언트 읽기 전까지 스켈레톤을 보여줘요. 빈 배열로 시작하면 사용자가 "없음"으로 오해해요.

## 데이터

프로젝트는 Cloudflare D1에 저장하고 웹은 `POST /api/graphql` 한 곳으로만 읽고 써요. 계약은 [`specs/features/004-project.md`](../../specs/features/004-project.md)가 정해요.

- 스키마 원본은 `schema.graphql` 하나예요. 고친 뒤에는 `pnpm --filter @mobydick/web relay`를 돌려요. 이 명령이 `src/__generated__`를 다시 만들어요.
- 워커는 런타임에 파일을 못 읽어서 스키마를 TS 모듈로 옮겨 담아요. `src/__generated__`는 손으로 고치지 않아요.
- GraphQL은 enum을 SCREAMING_CASE로, 도메인은 소문자로 써요. 두 표기를 아는 곳은 `src/graphql/enums.ts`뿐이에요.
- Relay는 상대 경로로 요청해서 브라우저에서만 동작해요. 쿼리를 쓰는 컴포넌트는 `ClientQuery`로 감싸요. `Suspense`만 쓰면 프리렌더가 깨져요.
- 스키마를 바꾸면 `migrations`에 파일을 더하고 `db:migrate:local`과 `db:migrate`를 둘 다 돌려요.
- 바인딩을 바꾸면 `pnpm --filter @mobydick/web cf-typegen`으로 `cloudflare-env.d.ts`를 다시 만들어요.

## 스타일

- 색상은 semantic 토큰만 써요. `bg-bg-*`, `text-fg-*`, `border-stroke-*` 형식이에요.
- 토큰 정의는 디자인 시스템이 소유해요. `globals.css`에 새 색상 변수를 만들지 않아요.
- `tailwind.config` 파일을 만들지 않아요. 토큰은 디자인 시스템의 `@theme`에 있어요.
- 다크 테마는 운영체제 설정(`prefers-color-scheme`)을 따라가요. 토글은 아직 스펙에 없어요.

## 라이브러리

- 훅과 유틸 컴포넌트는 `react-simplikit`에 있는지 먼저 확인해요.
- 배열과 객체 조작은 `es-toolkit`을 써요.
- 판별 유니온과 다중 조건 분기는 `ts-pattern`의 `match`로 표현하고 `exhaustive()`로 닫아요.
- 애니메이션은 `motion`을 써요. `useReducedMotion()`으로 끌 수 있게 만들어요.
- 아이콘은 `@mobydick/icon`에서 가져와요. 앱에 SVG를 직접 그리지 않아요.

## 배포

Cloudflare Workers에 `@opennextjs/cloudflare`로 올려요. 워커 이름은 `mobydick-web`이에요.

- `pnpm --filter @mobydick/web preview`로 workerd에서 먼저 확인하고 `deploy`로 올려요. `next build`만으로는 워커 번들이 안 나와요.
- `export const runtime = "edge"`를 쓰지 않아요. 이 어댑터가 지원하지 않아요.
- `wrangler.jsonc`의 `main`과 `assets`는 빌드 산출 경로라서 바꾸지 않아요.
- D1 바인딩 이름은 `DB` 하나예요. `getCloudflareContext({ async: true })`로 꺼내고 없으면 멈춰요.
- 증분 캐시(R2)와 self-reference 바인딩을 두지 않았어요. ISR이나 `revalidate`를 쓰기 시작하면 그때 추가해요.

## 검증

- `pnpm --filter @mobydick/web typecheck`
- `pnpm --filter @mobydick/web build`
- `pnpm --filter @mobydick/web preview` (워커 런타임 확인)
