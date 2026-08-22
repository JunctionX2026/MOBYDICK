# MOBYDICK

흩어진 공공데이터를 찾아서, 붙여서, 쓸 수 있는 형태로 내보내요. Discover → Compose → Serve.

JunctionX Korea 2026 · Team 44 · Microsoft Track (경상북도 공공데이터로 지역 문제 해결)

## 무엇을 만드나요

| 단계 | 기능              | 하는 일        | 다음으로 넘기는 것    |
| ---- | ----------------- | -------------- | --------------------- |
| ①    | 그래프 지식 베이스 | 찾는다         | 제안 (데이터 + 컬럼)  |
| ②    | 워크플로 캔버스    | 붙인다 · 확인한다 | 완성된 워크플로       |
| ③    | 배포 (API / MCP)   | 내보낸다       | -                     |

세 기능은 병렬 기능이 아니라 직렬 파이프예요. 자세한 정의는 [`specs/product/brief.md`](specs/product/brief.md)에 있어요.

## 시작하기

```bash
pnpm install
pnpm dev
```

Node 22 이상과 pnpm이 필요해요.

## 배포

웹 앱은 Cloudflare Workers에서 돌아가요. https://mobydick-web.haklee.workers.dev

```bash
pnpm --filter @mobydick/web preview   # 워커 런타임에서 로컬 확인
pnpm --filter @mobydick/web deploy    # 빌드 후 배포
```

## 어디를 보나요

| 알고 싶은 내용            | 먼저 볼 곳                                     |
| ------------------------- | ---------------------------------------------- |
| 무엇을 만들기로 했는지    | [`specs/README.md`](specs/README.md)           |
| 작업 규칙과 스택          | [`AGENTS.md`](AGENTS.md)                       |
| 문서 탐색 경로            | [`docs/README.md`](docs/README.md)             |
| 외부 사례를 채택한 이유   | [`research/README.md`](research/README.md)     |
