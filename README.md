# Swish

![Swish](apps/web/public/brand/swish-logo-horizontal.svg)

**JunctionX Korea 2026 · Team 44 MOBYDICK · Microsoft Track**

Swish는 흩어진 경상북도 공공데이터를 찾아서, 붙여서, API와 MCP로 내보내는 데이터 워크플로 서비스예요.

## 배경

공공데이터를 실제 서비스에 활용하려면 데이터 탐색, 활용 신청, 키 발급, 형식 확인을 데이터마다 반복해야 해요. 같은 지역도 이름과 행정코드가 제각각이고 시간·측정 단위도 달라서, 여러 데이터를 연결할 때 누락과 잘못된 조인이 조용히 발생해요. 완성한 분석도 API나 MCP로 다시 구성해야 하므로 재사용하기 어려워요.

## 해결

Swish는 발견부터 배포까지 하나의 직렬 파이프로 연결해요.

| 단계 | 하는 일 | 결과 |
| --- | --- | --- |
| **Discover** | 질문을 바탕으로 카탈로그에서 관련 데이터와 컬럼을 추천해요. | 데이터셋과 조인 후보를 만들어요. |
| **Compose** | 캔버스에서 데이터를 연결하고 지역코드 정규화, 조인, 변환을 실행해요. | 행 수, 결측률, 매칭률과 제외 사유를 단계마다 확인해요. |
| **Serve** | 검증된 워크플로 스냅샷을 배포해요. | 같은 결과를 REST API와 MCP로 제공해요. |

AI는 실행할 코드를 만들지 않고 선언적 `OperationSpec`만 제안해요. 실제 계산은 검증된 결정적 코드가 담당하며, 행 수 급감이나 낮은 매칭률 같은 품질 문제는 사용자에게 정지 신호로 보여줘요.

## 기대 효과

- 질문에서 활용 가능한 공공데이터까지 도달하는 탐색 시간을 줄여요.
- 지역명과 코드가 다른 데이터도 정규화해 안전하게 연결해요.
- 중간 결과와 탈락 사유를 드러내 데이터 품질을 직접 판단할 수 있게 해요.
- 완성한 분석을 API와 MCP로 즉시 재사용해 반복 업무와 AI 활용을 연결해요.

## 테크 스펙

| 영역 | 기술 | 역할 |
| --- | --- | --- |
| Web | Next.js App Router, React, TypeScript, Tailwind CSS | 프로젝트와 워크플로 캔버스를 제공해요. |
| API | GraphQL, Relay | 프로젝트와 워크플로 상태를 읽고 저장해요. |
| Data | FastAPI, DuckDB | 공공데이터 검색, 조인, 변환을 실행해요. |
| AI | OpenAI Responses API, Structured Outputs | 질문을 검증 가능한 선언적 스펙으로 변환해요. |
| Infra | Cloudflare Workers, Containers, D1 | 웹, 데이터 런타임, 프로젝트 저장소를 운영해요. |
| Tooling | pnpm workspace, Vitest | 모노레포 의존성과 계약 테스트를 관리해요. |

```text
질문 → 데이터 추천 → 워크플로 조립·검증 → REST API / MCP
       FastAPI + DuckDB       Next.js         Cloudflare
```

## 로컬 실행

Node.js 22 이상과 pnpm이 필요해요. GovData 런타임의 자세한 준비 방법은 [로컬 개발 안내](docs/LOCAL_DEVELOPMENT.md)를 확인해요.

```bash
pnpm install
pnpm dev
```

전체 검증은 아래 명령으로 실행해요.

```bash
pnpm verify
```

제품 계약은 [스펙 인덱스](specs/README.md), 저장소 탐색 경로는 [문서 안내](docs/README.md)에서 확인해요.
