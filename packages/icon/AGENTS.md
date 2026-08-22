# 아이콘 작업 안내

공용 React SVG 아이콘을 제공해요. 앱과 디자인 시스템이 같은 아이콘 계약을 쓰도록 이 패키지 하나만 봐요.

- 모든 아이콘은 공용 `Icon` wrapper와 `IconProps`를 거쳐요. 크기와 `aria-hidden` 기본값이 아이콘마다 달라지지 않게 하려는 거예요.
- 브랜드 자산이 아니면 `stroke`와 `fill`에 `currentColor`를 써요. 색은 호출부의 텍스트 색을 따라가요.
- 장식 아이콘은 보조 기술에서 숨겨요. 아이콘만으로 의미를 전달하면 호출부에서 `aria-label`을 줘요.
- 원본 `viewBox`를 유지하고 래스터 데이터나 상호작용 래퍼를 넣지 않아요.
- 파일은 kebab-case, 컴포넌트는 PascalCase예요. 파일 하나에 아이콘 하나만 둬요.
- 모든 아이콘에 `displayName`을 지정하고 `src/index.ts`에서 export해요.

## 검증

- `pnpm --filter @mobydick/icon typecheck`
