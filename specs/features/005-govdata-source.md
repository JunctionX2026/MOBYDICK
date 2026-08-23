# GovData Studio DuckDB 데이터 소스

- 상태: implemented
- 갱신: 2026-08-23
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
- 로컬에서는 Next 앱과 FastAPI를 각각 실행하고, 외부 데모가 필요하면 Next 앱만 ngrok으로 공개해요. 해커톤 동안 외부 요청도 FastAPI의 OpenAI planner까지 통과할 수 있어요.
- 프로젝트 설명을 입력하면 FastAPI planner가 후보 데이터 소스, 선언적 파이프라인, DuckDB 결과를 한 번에 만들어요.
- 프로젝트 캔버스의 `실시간 API 호출` 모달에서 allowlist 카탈로그를 고르고 payload를 입력해 공공데이터 API를 한 건씩 호출해요.
- 실시간 호출 결과는 인증키를 제외한 실제 payload, HTTP 상태, 원본 response, 정규화한 records를 같은 모달에서 확인해요.
- OpenAI planner가 계약에 맞지 않는 계획을 반환하면 FastAPI가 이를 웹에 전달하지 않고 검증된 결정적 fallback 계획으로 교체해요.
- OpenAI planner가 제한 시간 안에 응답하지 않으면 프로젝트 생성이 멈추지 않도록 검증된 결정적 fallback 계획으로 전환해요.
- 자원 데이터의 지역 커버리지가 부분적이면 위험·인구·기상 기준 지역을 보존하는 `left` 조인으로 실행하고, 자원 결측률은 별도 품질 게이트로 확인해요.
- Next.js의 GovData 프록시는 내부 camelCase 타입을 외부 snake_case wire 계약으로 다시 직렬화한 뒤 브라우저에 반환해요.
- 캔버스의 소스·조인·변환·출력 노드는 우클릭 메뉴와 상단 실행 버튼으로 실행할 수 있어요. 선택한 노드까지의 선행 소스를 하나의 REST 실행 요청으로 처리하고, 해당 단계의 행·컬럼·매칭 상세를 보여줘요.
- 실행 요청의 선언적 payload와 검증된 response는 화면에서 확인할 수 있어요. 실시간 공공데이터 호출은 인증키를 제외한 payload·response snapshot을 로컬 cache에 저장하고, 네트워크 실패 시 명시적으로 허용된 replay 모드에서만 재사용해요.
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
| `POST /api/deployments/:id` | `POST /api/run` | 저장된 OperationSpec → API 결과 |
| `GET/POST /api/mcp/:id` | `POST /api/run` | MCP manifest·JSON-RPC `query_project` |

`GOVDATA_SOURCE_URL`은 FastAPI 서버의 origin이에요. 로컬 기본값은 `http://127.0.0.1:8000`이고, 배포 환경에서는 외부 접근 가능한 데이터 소스 origin을 명시해요.

검색과 추천의 `k`는 1에서 20 사이로 제한해요. 공개 프록시를 거치지 않는 직접 호출도 같은 범위를 사용해요.

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
5. 실행 단계에서는 선택된 `OperationSpec`만 `/api/govdata/run`으로 보내고, `dropped_detail`과 각 항목의 `reason_code`를 숨기지 않아요.
6. 실시간 API 호출은 카탈로그에서 서비스와 오퍼레이션을 고른 뒤 JSON payload를 검증하고 `/api/govdata/live`로 보내요.
7. 실시간 호출이 성공하면 payload·response·records를 보여주고, 실패하면 빈 결과 대신 이유를 보여줘요.
8. 실시간 API 모달을 호출 중에 닫으면 진행 중인 요청을 취소하고, 다시 열었을 때 새 호출을 시작할 수 있는 상태로 초기화해요.

## AI 경계

추천과 DuckDB 실행은 AI 없이 동작해야 해요. AI 플래너는 선택 기능이고, 결과는 반드시 `OperationSpec` 파서와 DuckDB 컴파일러를 통과해야 해요.

OpenAI planner는 FastAPI 프로세스에서만 Responses API로 실행하고, `OPENAI_API_KEY`를 웹 앱·브라우저·배포 응답에 전달하지 않아요. 기본 모델은 `gpt-5.6-luna`이고, Structured Outputs의 JSON Schema를 유일한 출력 계약으로 사용해요. 해커톤 기간에는 외부 요청도 planner를 사용할 수 있어요. 기능이 꺼져 있거나 OpenAI 호출이 실패하면 번들의 결정적 추천 스펙으로 폴백해요. AI가 만든 스펙도 `OperationSpec` 컴파일과 DuckDB 실행 검증을 통과해야 해요.

planner 호출은 Responses API의 `text.format.type=json_schema`와 엄격한 JSON Schema를 유일한 출력 계약으로 사용하고, 데이터셋 선택과 선언적 스펙 작성에 맞춘 낮은 추론 단계로 실행해요. 기본 제한 시간은 30초예요. 제한 시간 안에 응답하면 `planner: "openai"`를, 실패하거나 제한 시간을 넘기면 `planner: "fallback"`과 오류 이유를 반환해요. 웹 클라이언트는 네트워크 여유를 포함해 35초까지 기다리고, 화면을 떠나거나 제한 시간을 넘기면 진행 중인 요청을 취소해요.

planner 응답은 `OperationSpec` 파서가 허용하는 식별자, 연산자, 필수 필드를 사용해야 해요. OpenAI 응답이 JSON Schema, OperationSpec 계약 또는 실행 검증 중 하나라도 통과하지 못하면 FastAPI가 검색 결과에서 만든 fallback을 실행하고 `planner: "fallback"`과 `planner_error`를 반환해요. 이 경우에도 `pipeline`, `result`, `dropped_detail`을 포함한 동일한 응답 구조를 유지해요.

자원·대피 장소처럼 기준 지역 일부만 제공하는 데이터가 포함되면 planner는 기준 지역을 보존하는 `left` 조인을 선택할 수 있어요. 이 경우 `dropped_detail`은 매칭되지 않은 자원 지역을 계속 보여주고, 결과의 결측률이 20%를 넘을 때만 실행을 멈춰요. 기준 지역 자체가 줄어드는 `inner` 조인은 기존처럼 50% 미만 매칭률에서 멈춰요.

`POST /api/plan`과 배포 API의 `schema`는 object schema예요. `properties`의 각 항목은 결과 컬럼 이름과 같거나 `{ "column": "결과컬럼" }` 또는 `{ "from": "결과컬럼" }`으로 매핑해요. 실행 결과에는 원본 표 형식과 함께 `output` JSON 목록이 포함돼요.

## 실패와 정지 조건

| 감지 | 사용자에게 보이는 것 | 진행 여부 |
| --- | --- | --- |
| FastAPI 데이터 소스에 연결할 수 없어요 | 데이터 소스를 연결하지 못했다는 이유와 로컬 실행 방법 | 정지 |
| FastAPI가 응답하지 않아요 | DuckDB 서버를 실행하라는 안내 | 정지 |
| OpenAI planner가 제한 시간 안에 응답하지 않아요 | 검증된 fallback 계획으로 전환했다는 안내 | 계속 |
| 응답이 계약에 맞지 않아요 | 데이터 소스 응답 검증 실패 | 정지 |
| 추천 신뢰도가 낮아요 | 약한 매칭 배지와 검색 결과 | 사용자가 판단 |
| 실행 결과 행이 0개예요 | 빈 결과와 원본 스펙 | 정지 |
| 직전 단계 대비 행 수가 50% 미만이에요 | 변화 전후 행 수와 정지 이유 | 정지 |
| 조인 매칭률이 50% 미만이에요 | `dropped_detail`의 매칭률, 탈락 키, 정규화 실패 또는 타 소스 미매칭 사유 | 정지 |
| 결과 결측률이 20%를 초과해요 | 결측률과 정지 이유 | 정지 |

## 인수 기준

- [x] FastAPI를 로컬에서 실행하면 웹 앱이 번들의 `/api/recommend` 결과를 읽어요.
- [x] 데이터 소스가 꺼져 있으면 브라우저에 빈 목록 대신 연결 실패 이유가 보여요.
- [x] 추천된 데이터셋을 선택하면 캔버스 소스 노드에 `datasetId`가 저장돼요.
- [x] 새로고침 후에도 소스 노드의 데이터셋 식별자가 보존돼요.
- [x] 잘못된 `OperationSpec`과 잘못된 외부 응답은 웹 앱의 타입 경계를 통과하지 못해요.
- [x] 데모 SQL 10개가 번들 DuckDB에서 행을 반환해요.
- [ ] 외부 데모에서는 Next 앱 하나만 ngrok으로 공개하고, FastAPI 포트는 직접 공개하지 않아요.
- [x] OpenAI planner가 FastAPI에서 질문을 OperationSpec으로 만들고 DuckDB 결과와 파이프라인을 반환해요.
- [x] OpenAI가 잘못된 식별자나 필드를 반환해도 웹에는 파이프라인 계약 오류가 노출되지 않고 fallback 계획이 표시돼요.
- [x] OpenAI planner가 제한 시간 안에 응답하지 않아도 프로젝트 생성이 검증된 fallback 계획으로 완료돼요.
- [x] 부분 커버리지 자원 데이터는 `left` 조인으로 기준 지역을 보존하고, 결측률이 높을 때만 파이프라인을 멈춰요.
- [x] 웹 클라이언트가 FastAPI planner 제한 시간보다 먼저 실패하지 않고, 화면을 떠나면 진행 중인 planner 요청을 취소해요.
- [x] 노드 우클릭 실행과 상단 실행이 비활성화되지 않고, 소스는 단일 실행, 조인·변환·출력은 선행 소스 전체 실행 결과를 보여줘요.
- [ ] `dropped_detail.reason_code`가 지역 키 정규화 실패와 다른 소스 미매칭을 구분해요.
- [x] 실시간 API의 저장 snapshot에 serviceKey가 없고, replay가 명시적으로 켜지지 않으면 live 실패를 stale 데이터로 바꾸지 않아요.
- [x] 실시간 API 카탈로그를 화면에서 불러오고 서비스·오퍼레이션·필수 payload를 확인할 수 있어요.
- [x] 실시간 API를 한 건씩 호출하면 인증키를 제외한 payload, 원본 response, 정규화한 records를 모달에서 확인할 수 있어요.
- [x] 실시간 API 모달을 호출 중에 닫았다가 다시 열어도 이전 요청 상태가 남지 않아요.
- [x] 출력 스키마를 주면 API와 MCP가 JSON 객체 목록을 반환해요.
- [x] 실시간 공공데이터 catalog와 실행 응답이 웹·FastAPI 경계에서 검증돼요.
- [x] 실시간 실행 payload에는 인증키를 넣을 수 없고 FastAPI가 allowlist endpoint만 호출해요.

## 근거

- [`../../research/external/govdatastudiobundle/README.md`](../../research/external/govdatastudiobundle/README.md)
- [`../../research/external/govdatastudiobundle/CLAUDE_ragtag.md`](../../research/external/govdatastudiobundle/CLAUDE_ragtag.md)
- [`../../research/external/govdatastudiobundle/qa_report.md`](../../research/external/govdatastudiobundle/qa_report.md)
- [`../../research/external/govdatastudiobundle/data/demo_questions.md`](../../research/external/govdatastudiobundle/data/demo_questions.md)
