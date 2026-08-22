# Seed Design 토큰 아키텍처

- Reviewed: 2026-08-22

### Sources

- [daangn/seed-design](https://github.com/daangn/seed-design) (기본 브랜치 `dev`)
- `packages/tailwind4-theme/index.css` (Tailwind v4 `@theme` 매핑의 1차 출처)
- `packages/css/vars`, `packages/css/recipes`
- `packages/tailwind4-theme/LICENSE`, `packages/tailwind4-theme/NOTICE`

### Adopt

토큰 이름 문법을 채택해요. 세 층으로 나누고 각 층이 아래 층만 참조해요.

| 층       | 형식                                                    | 예                                    |
| -------- | ------------------------------------------------------- | ------------------------------------- |
| palette  | `--<ns>-color-palette-<hue>-<step>`                     | `--moby-color-palette-blue-500`       |
| semantic | `--<ns>-color-<role>-<tone>[-<emphasis>][-<state>]`     | `--moby-color-bg-brand-solid-pressed` |
| theme    | Tailwind `@theme inline`이 semantic을 유틸리티로 노출해요 | `bg-bg-brand-solid`                   |

역할과 어휘를 채택해요. 이 어휘가 아니면 토큰을 추가하지 않아요.

- `role`: `bg`, `fg`, `stroke`
- `tone`: `neutral`, `brand`, `critical`, `warning`, `positive`, `informative`, `layer`
- `emphasis`: `solid`, `weak`, `muted`, `subtle`, `contrast`, `inverted`
- `state`: `pressed`, `selected`

같은 tone이 `bg`, `fg`, `stroke` 세 역할에 모두 존재하는 구조를 채택해요. 정지 신호를 `critical`, `warning`, `informative`, `positive` 네 tone으로 표현할 때 배경, 글자, 테두리가 따로 놀지 않아요.

`solid`와 `weak`를 짝으로 두는 규칙을 채택해요. `solid`는 채워진 면이고 `weak`는 옅은 배경이에요. 각각 `-pressed`를 가져요.

레시피를 컴포넌트 파일에서 분리하는 구조를 채택해요. 여러 부분으로 구성된 컴포넌트는 slot별 클래스를 한 곳에서 정의해요.

### Do Not Adopt

- 브랜드 팔레트 값을 가져오지 않아요. `carrot` hue와 실제 색상 값은 당근마켓 브랜드 리소스예요. MOBYDICK은 자체 팔레트를 `styles/palette.css`에 정의해요.
- `manner-temp`, `banner-*`처럼 당근마켓 제품 전용 토큰을 가져오지 않아요.
- Panda CSS, Qvism, Vanilla Extract 같은 Seed의 스타일 엔진을 가져오지 않아요. 저장소 스택은 Tailwind CSS v4예요.
- `--seed-` 네임스페이스를 쓰지 않아요. `--moby-`를 써요. 남의 시스템 토큰처럼 보이면 안 돼요.
- 컴포넌트 구현 코드를 복사하지 않아요. 구조만 참고하고 구현은 shadcn 방식(저장소가 소유하는 소스, `cva`, Radix primitive)으로 작성해요.
- `dimension-x1`처럼 숫자에 `x` 접두를 붙이는 표기를 쓰지 않아요. Tailwind v4의 `--spacing` 스케일을 그대로 써요.

### Provenance

Apache License 2.0이에요. 소스 재배포 시 라이선스 사본과 귀속 고지를 전달해야 해요. 우리는 코드를 재배포하지 않고 이름 문법과 계층 구조만 참고하므로 이 노트가 귀속 기록이에요.

`NOTICE`는 로고, 상호명, 캐릭터를 "브랜드 리소스"로 정의하고 상표법 보호를 명시해요. 당근마켓 제품으로 오인될 수 있는 사용을 금지해요. `carrot` 팔레트는 브랜드 식별 요소이므로 값을 옮기지 않아요.

### Local Evidence

- `packages/design-system/styles/palette.css`
- `packages/design-system/styles/semantic.css`
- `packages/design-system/styles/theme.css`
- `packages/design-system/src/recipes/button.ts`
