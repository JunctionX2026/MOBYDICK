# GovData Studio DuckDB 데이터 소스

- 상태: agreed
- 갱신: 2026-08-22
- 소유: (미정)

## 문제

경북 공공데이터 226개와 컬럼 RAG, 실측 조인 그래프가 이미 DuckDB 번들로 준비돼 있어요. 웹 앱이 파일을 직접 읽으려고 하면 Cloudflare Worker와 브라우저 모두에서 실행 환경이 달라지고, 데이터 소스와 화면이 강하게 묶여요.

## 범위

### 하는 것

- `apps/govdata`의 FastAPI 서버를 DuckDB 데이터 소스 런타임으로 사용해요.
- 웹 앱은 데이터 소스 서버의 HTTP API를 같은 출처 프록시로 감싸요.
- 공공데이터포털 allowlist API를 payload 기반으로 실제 호출하고 원본 응답과 레코드를 반환해요.
- 프로젝트 질문으로 추천을 받고, 추천된 데이터셋을 소스 노드로 캔버스에 배치해요.
- 소스 노드는 `datasetId`를 저장해서 제목 변경이나 설명 변경에 의존하지 않아요.
- 추천과 실행 응답은 웹 앱 경계에서 검증하고, 실패하면 빈 결과 대신 정지 신호를 보여줘요.
- 로컬에서는 Next 앱과 FastAPI를 각각 실행하고, 외부 데모가 필요하면 Next 앱만 ngrok으로 공개해요. 해커톤 동안 외부 요청도 FastAPI의 Codex planner까지 통과할 수 있어요.
- 프로젝트 설명을 입력하면 FastAPI planner가 후보 데이터 소스, 선언적 파이프라인, DuckDB 결과를 한 번에 만들어요.
- 배포는 API와 MCP 두 가지 주소를 제공하고, 선택적 출력 스키마가 있으면 JSON 객체 목록을 반환해요.

### 안 하는 것

- Next.js 또는 Cloudflare Worker 안에서 DuckDB 파일을 직접 열지 않아요.
- 브라우저에서 데이터 소스 URL, SQL, API 키를 직접 노출하지 않아요.
- 행을 임베딩하거나 LLM에 넘기지 않아요. 검색은 번들의 메타데이터 인덱스를 사용하고 계산은 DuckDB가 해요.
- Cloudflare 배포를 이번 통합의 필수 경로로 만들지 않아요.

## 데이터 소스 계약

웹 앱이 사용하는 번들 API는 아래 네 가지예요. 응답의 원본 필드가 추가되는 것은 허용하지만, 아래 필드는 반드시 검증해요.

| 웹 프록시 | 번들 API | 용도 |
| --- | --- | --- |
| `POST /api/govdata/recommend` | `POST /api/recommend` | 질문 → 데이터셋·조인 집합·기본 스펙 |
| `POST /api/govdata/plan` | `POST /api/plan` | 질문 → planner·파이프라인·검증된 실행 스펙·결과 |
| `POST /api/govdata/run` | `POST /api/run` | 선언적 `OperationSpec` → DuckDB 결과 |
| `GET /api/govdata/dataset/:id` | `GET /api/dataset/:id` | 데이터셋 카드와 컬럼 위키 |
| `GET /api/govdata/stats` | `GET /api/stats` | 연결 상태와 적재 수치 |
| `GET /api/govdata/live/catalog` | `GET /api/live/catalog` | 실시간 공공데이터 서비스·오퍼레이션 목록 |
| `POST /api/govdata/live` | `POST /api/live/execute` | payload → 공공데이터 응답·레코드 |
| `POST /api/deployments/:id` | `POST /api/plan` | 배포된 질문 → API 결과 |
| `GET/POST /api/mcp/:id` | Next.js → FastAPI planner | MCP manifest·JSON-RPC `query_project` |

`GOVDATA_SOURCE_URL`은 FastAPI 서버의 origin이에요. 로컬 기본값은 `http://127.0.0.1:8000`이고, 배포 환경에서는 외부 접근 가능한 데이터 소스 origin을 명시해요.

실시간 공공데이터 서비스는 다음 endpoint를 사용해요. endpoint와 인증키는 FastAPI 환경 변수로 관리하고 브라우저에는 노출하지 않아요.

| 서비스 | 환경 변수 | 기본 오퍼레이션 |
| --- | --- | --- |
| TAGO 정류소 | `TAGO_STATION` | `getCtyCodeList` |
| TAGO 노선 | `TAGO_ROUTE` | `getCtyCodeList` |
| TAGO 버스 위치 | `TAGO_BUS_LOCATION` | `getCtyCodeList` |
| TAGO 도착 | `TAGO_ARRIVAL` | `getCtyCodeList` |
| 병·의원 | `NMC_HOSPITAL` | `getHsptlMdcncListInfoInqire` |
| 행정동 인구 | `MOIS_POPULATION` | `selectAdmmSexdAgePpltn` |
| 무더위쉼터 | `HEAT_SHELTER` | endpoint 자체 |

`POST /api/govdata/live` 요청은 `{ "service": "NMC_HOSPITAL", "operation": "getHsptlMdcncListInfoInqire", "payload": { ... } }` 형태예요. 응답에는 `payload`, `response`, `records`, `record_count`, `total_count`가 포함되며 `serviceKey`는 항상 서버에서만 관리해요. `MOIS_POPULATION`은 `admmCd`, `srchFrYm`, `srchToYm`이 필수예요.

## 동작

1. 사용자가 프로젝트에서 `데이터 소스` 노드를 추가해요.
2. 웹 앱이 프로젝트 질문을 `/api/govdata/recommend`로 보내요.
3. 검색 결과와 실측 조인 가능성을 보여줘요. 약한 검색 결과는 그대로 표시하되 신뢰도가 낮다고 알려요.
4. 사용자가 데이터셋을 고르면 소스 노드에 `datasetId`, 제목, 요약을 넣고 캔버스에 배치해요.
5. 실행 단계에서는 선택된 `OperationSpec`만 `/api/govdata/run`으로 보내고, `dropped_detail`을 숨기지 않아요.

## AI 경계

추천과 DuckDB 실행은 AI 없이 동작해야 해요. AI 플래너는 선택 기능이고, 결과는 반드시 `OperationSpec` 파서와 DuckDB 컴파일러를 통과해야 해요.

Codex planner는 FastAPI 프로세스에서만 `codex exec --ephemeral --json --sandbox read-only`로 실행하고, Codex CLI가 관리하는 ChatGPT OAuth 세션을 사용해요. Vercel AI SDK나 OpenAI API 키를 사용하지 않고, OAuth 토큰도 웹 앱·브라우저·배포 응답에 전달하지 않아요. 해커톤 기간에는 외부 요청도 planner를 사용할 수 있어요. 기능이 꺼져 있거나 Codex 호출이 실패하면 번들의 결정적 추천 스펙으로 폴백해요. AI가 만든 스펙도 `OperationSpec` 컴파일과 DuckDB 실행 검증을 통과해야 해요.

`POST /api/plan`과 배포 API의 `schema`는 object schema예요. `properties`의 각 항목은 결과 컬럼 이름과 같거나 `{ "column": "결과컬럼" }` 또는 `{ "from": "결과컬럼" }`으로 매핑해요. 실행 결과에는 원본 표 형식과 함께 `output` JSON 목록이 포함돼요.

## 실패와 정지 조건

| 감지 | 사용자에게 보이는 것 | 진행 여부 |
| --- | --- | --- |
| FastAPI 데이터 소스에 연결할 수 없어요 | 데이터 소스를 연결하지 못했다는 이유와 로컬 실행 방법 | 정지 |
| FastAPI가 응답하지 않아요 | DuckDB 서버를 실행하라는 안내 | 정지 |
| 응답이 계약에 맞지 않아요 | 데이터 소스 응답 검증 실패 | 정지 |
| 추천 신뢰도가 낮아요 | 약한 매칭 배지와 검색 결과 | 사용자가 판단 |
| 실행 결과 행이 0개예요 | 빈 결과와 원본 스펙 | 정지 |
| 조인 키가 빠졌어요 | `dropped_detail`의 매칭률과 탈락 키 | 정지 |

## 인수 기준

- [ ] FastAPI를 로컬에서 실행하면 웹 앱이 번들의 `/api/recommend` 결과를 읽어요.
- [ ] 데이터 소스가 꺼져 있으면 브라우저에 빈 목록 대신 연결 실패 이유가 보여요.
- [ ] 추천된 데이터셋을 선택하면 캔버스 소스 노드에 `datasetId`가 저장돼요.
- [ ] 새로고침 후에도 소스 노드의 데이터셋 식별자가 보존돼요.
- [ ] 잘못된 `OperationSpec`과 잘못된 외부 응답은 웹 앱의 타입 경계를 통과하지 못해요.
- [ ] 데모 SQL 10개가 번들 DuckDB에서 행을 반환해요.
- [ ] 외부 데모에서는 Next 앱 하나만 ngrok으로 공개하고, FastAPI 포트는 직접 공개하지 않아요.
- [ ] Codex OAuth planner가 FastAPI에서 질문을 OperationSpec으로 만들고 DuckDB 결과와 파이프라인을 반환해요.
- [ ] 출력 스키마를 주면 API와 MCP가 JSON 객체 목록을 반환해요.
- [ ] 실시간 공공데이터 catalog와 실행 응답이 웹·FastAPI 경계에서 검증돼요.
- [ ] 실시간 실행 payload에는 인증키를 넣을 수 없고 FastAPI가 allowlist endpoint만 호출해요.

## 근거

- [`../../research/external/govdatastudiobundle/README.md`](../../research/external/govdatastudiobundle/README.md)
- [`../../research/external/govdatastudiobundle/CLAUDE_ragtag.md`](../../research/external/govdatastudiobundle/CLAUDE_ragtag.md)
- [`../../research/external/govdatastudiobundle/qa_report.md`](../../research/external/govdatastudiobundle/qa_report.md)
- [`../../research/external/govdatastudiobundle/data/demo_questions.md`](../../research/external/govdatastudiobundle/data/demo_questions.md)
