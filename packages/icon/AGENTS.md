# 아이콘 작업 안내

공용 React SVG 아이콘을 제공해요. 앱과 디자인 시스템이 같은 아이콘 계약을 쓰도록 이 패키지 하나만 봐요.

## 출처

`src/components`는 [Tabler Icons](https://tabler.io/icons) (MIT)에서 생성해요. 직접 편집하지 않고 `icons.json`에 항목을 더한 뒤 `pnpm --filter @mobydick/icon generate`를 돌려요. 생성기는 디렉터리를 통째로 다시 써요.

`icons.json`은 Tabler 아이콘 이름을 키로 쓰고, 우리 컴포넌트 이름과 가져올 변형을 값으로 둬요.

```json
{ "player-play": { "name": "Play", "variants": ["outline", "filled"] } }
```

- `outline` 변형은 `PlayIcon`, `filled` 변형은 `PlayFilledIcon`이 돼요.
- Tabler에 없는 변형을 적으면 생성이 실패해요. 조용히 건너뛰지 않아요.
- `src/brand`는 Tabler와 무관한 자체 자산이에요. 생성기가 건드리지 않아요.

## 규칙

- 모든 아이콘은 공용 `Icon` wrapper와 `IconProps`를 거쳐요. 크기와 `aria-hidden` 기본값이 아이콘마다 달라지지 않게 하려는 거예요.
- 사이드 네비게이션은 `filled` 변형을 써요. 나머지 자리(캔버스 노드, 툴바, 본문)는 `outline` 변형을 써요.
- 브랜드 자산이 아니면 `stroke`와 `fill`에 `currentColor`를 써요. 색은 호출부의 텍스트 색을 따라가요.
- 장식 아이콘은 보조 기술에서 숨겨요. 아이콘만으로 의미를 전달하면 호출부에서 `aria-label`을 줘요.
- 원본 `viewBox`를 유지하고 래스터 데이터나 상호작용 래퍼를 넣지 않아요.
- 파일은 kebab-case, 컴포넌트는 PascalCase예요. 파일 하나에 아이콘 하나만 둬요.

## 검증

- `pnpm --filter @mobydick/icon generate`
- `pnpm --filter @mobydick/icon typecheck`
