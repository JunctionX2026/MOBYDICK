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
- `dark.css`는 `semantic.css`에 있는 토큰만 덮어써요. 한쪽에만 있는 토큰은 `tokens.test.ts`가 막아요.
- 새 토큰이 필요하면 먼저 기존 tone과 emphasis 조합으로 표현할 수 있는지 확인해요.

## 컴포넌트 규칙

- 스타일은 `src/recipes`에, 마크업과 동작은 `src/components`에 둬요. 컴포넌트 파일에서 `cva`를 호출하지 않아요.
- 레시피는 `cva`로 작성하고 `variants`, `compoundVariants`, `defaultVariants`를 명시해요.
- 여러 부분으로 구성된 컴포넌트는 레시피를 slot별로 나누고(`calloutRootRecipe`, `calloutIconRecipe`) 컴포넌트는 `Object.assign`으로 묶어요.
- 트리거로 쓰는 컴포넌트는 `asChild`를 지원해요. Radix `Slot`을 써요.
- 포커스, dismiss, position 동작이 필요하면 직접 만들지 않고 Radix primitive를 먼저 확인해요.
- DOM props와 `ref`, 접근 가능한 이름, `focus-visible` 상태를 보존해요.
- 새 컴포넌트는 kebab-case 폴더에 구현과 `index.ts`를 두고 `src/index.ts`에서 export해요.
- 앱 라우트, 도메인 로직, 제품 문구를 가져오지 않아요.

## 테스트

토큰 계약과 상호작용만 테스트해요. 클래스 목록과 단순 렌더링은 테스트하지 않아요.
