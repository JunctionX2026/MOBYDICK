# 디자인 시스템 작업 안내

공용 컴포넌트와 디자인 토큰을 제공해요. 토큰 이름 문법은 Seed Design에서 가져왔어요. 근거는 [`seed-design-token-architecture.md`](../../research/external/design/seed-design-token-architecture.md)에 있어요.

## 토큰 계층

세 층으로 나누고 각 층은 아래 층만 참조해요. 층을 건너뛰면 다크 테마가 깨져요.

| 파일                  | 층       | 형식                                                |
| --------------------- | -------- | --------------------------------------------------- |
| `styles/palette.css`  | palette  | `--moby-color-palette-<hue>-<step>`                 |
| `styles/semantic.css` | semantic | `--moby-color-<role>-<tone>[-<emphasis>][-<state>]` |
| `styles/dark.css`     | semantic | `prefers-color-scheme: dark`에서 semantic만 덮어써요 |
| `styles/theme.css`    | theme    | `@theme inline`으로 Tailwind 유틸리티를 만들어요    |

- `role`은 `bg`, `fg`, `stroke` 세 가지예요.
- `tone`은 `neutral`, `brand`, `critical`, `warning`, `positive`, `informative`, `layer`예요.
- `emphasis`는 `solid`, `weak`, `muted`, `subtle`, `contrast`, `inverted`예요.
- `state`는 `pressed`, `selected`예요.

`solid`는 채워진 면, `weak`는 옅은 배경이에요. `<tone>-contrast`는 그 tone의 `solid` 위에 올라가는 글자색이에요.

## 사용 규칙

- 유틸리티 이름에 role이 그대로 남아요. `bg-bg-brand-solid`, `text-fg-neutral`, `border-stroke-neutral-muted`처럼 써요. 겹쳐 보이지만 이 덕분에 `bg-fg-neutral` 같은 잘못된 조합이 눈에 띄어요.
- palette 토큰을 컴포넌트에서 직접 쓰지 않아요. semantic 토큰만 써요. 다크 테마는 semantic 층에서만 갈려요.
- 색상 값을 컴포넌트에 하드코딩하지 않아요.
- `dark.css`는 `semantic.css`에 있는 토큰만 덮어써요. 한쪽에만 있는 토큰은 다크 테마에서 조용히 비어요.
- 새 토큰이 필요하면 먼저 기존 tone과 emphasis 조합으로 표현할 수 있는지 확인해요.

## 컴포넌트 규칙

- 스타일은 `src/recipes`에, 마크업과 동작은 `src/components`에 둬요. 컴포넌트 파일에서 `variants`를 호출하지 않아요.
- 레시피는 `src/variants.ts`의 `variants`로 작성하고 `base`, `variants`, `defaults`를 명시해요. 두 variant가 함께 있을 때만 필요한 클래스는 `compound`에 둬요.
- variant 조합이 표를 이루면(badge의 tone x emphasis) 표를 `satisfies Record<...>`로 선언하고 `compound`를 거기서 만들어요. 손으로 나열하면 빠진 조합을 아무도 못 잡아요.
- variant가 없는 slot은 레시피로 감싸지 않고 클래스 문자열 상수로 둬요.
- 여러 부분으로 구성된 컴포넌트는 slot별로 나누고(`calloutRootRecipe`, `calloutIconClassName`) 컴포넌트는 `Object.assign`으로 묶어요.
- 트리거로 쓰는 컴포넌트는 `asChild`를 지원해요. Radix `Slot`을 써요. 라벨과 아이콘을 함께 그리는 컴포넌트는 자식 요소를 루트로 삼고 자식의 children을 라벨로 써요. Fragment를 `Slot`에 넘기면 className이 사라져요.
- 상태를 가지는 컴포넌트에만 `"use client"`를 선언해요. 나머지는 서버 컴포넌트로 둬요.
- 포커스, dismiss, position 동작이 필요하면 직접 만들지 않고 Radix primitive를 먼저 확인해요.
- DOM props와 `ref`, 접근 가능한 이름, `focus-visible` 상태를 보존해요.
- 새 컴포넌트는 kebab-case 폴더에 구현과 `index.ts`를 두고 `src/index.ts`에서 export해요.
- 앱 라우트, 도메인 로직, 제품 문구를 가져오지 않아요.

## 테스트

이 패키지에는 단위 테스트를 두지 않아요. 클래스 목록, 토큰 값, 단순 렌더링은 사용자가 겪을 위험과 직접 연결되지 않고 판정 기준도 구현 자신이라서 회귀를 잡지 못해요. 시각 변화는 화면에서 직접 확인해요.
