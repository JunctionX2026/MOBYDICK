# ③ API / MCP 배포

- 상태: implemented
- 갱신: 2026-08-23
- 소유: (미정)

## 문제

일회성 분석은 자산이 되지 않아요. 공공데이터는 연 단위로 갱신되므로 "같은 조합을 매년 다시"가 실제 수요예요. 그리고 이 단계가 있어야 "공공데이터를 AI가 쓸 수 있게 만든다"는 목적이 완성돼요.

## 사용자와 사용 시점

캔버스에서 원하는 결과를 얻은 사용자가 그 결과를 다시 쓰려는 순간이에요. 개발자는 API를, AI 사용 환경의 실무자는 MCP를 원해요.

## 범위

### 하는 것

- 워크플로를 고정 엔드포인트로 배포해요. 이게 기본값이에요.
- 프로젝트 설정에서 요청 기본값과 응답 payload 스키마를 JSON으로 저장해요.
- 프로젝트 설정에서 저장된 `OperationSpec`으로 예상 결과 컬럼을 보여주고, schema 매핑에 사용할 컬럼명을 안내해요.
- `request.filters`가 있으면 응답 payload 스키마의 필드와 연결해 결과 행을 좁혀요.
- 배포된 API는 저장된 `OperationSpec`을 다시 planner에 보내지 않고 그대로 실행해요.
- API와 MCP 주소는 배포 모달을 열면 동시에 만들고 각각 복사할 수 있어요.
- 배포 모달에서 API의 \`{ request, schema }\`와 MCP \`tools/call\`의 최소 호출 예시를 확인해요.
- MCP는 HTTP JSON-RPC 도구로 노출해요.
- API와 MCP의 `request`, `schema` 입력은 JSON 객체여야 하고, 계약에 없는 입력은 거부해요.

### 안 하는 것

- 회원가입과 권한 관리를 하지 않아요.
- 배포 이력과 롤백을 관리하지 않아요.
- 임의 코드를 실행하지 않아요.

## 동작

1. 프로젝트 설정에서 요청 기본값과 payload 스키마를 입력하고 저장해요.
2. 배포 모달을 열면 API와 MCP 고정 엔드포인트가 생겨요.
3. API 또는 MCP 요청의 `schema`가 있으면 저장된 payload 스키마보다 우선해요.
4. 요청의 `filters`가 있으면 payload 필드명 또는 결과 컬럼명으로 결과 행을 필터링해요.
5. 저장된 `OperationSpec`을 실행하고 표 결과와 JSON output을 반환해요.

사용자가 만든 파이프라인이 새로운 공공데이터 MCP가 돼요. 공공데이터 → 이 플랫폼 → 새 MCP → AI가 사용. 루프가 닫혀요.

## 계약

입력은 [`011-seam-workflow-to-deployment.md`](011-seam-workflow-to-deployment.md)의 `Workflow`예요. 배포 실행기는 캔버스 실행기와 같은 `OperationSpec` 실행 함수를 공유해요.

## 인수 기준

- [x] 배포 모달을 열면 API와 MCP 주소가 모두 보이고 각각 복사할 수 있어요.
- [x] 배포 모달에서 API와 MCP의 최소 호출 body 형식이 보여요.
- [x] API를 호출하면 planner를 다시 호출하지 않고 저장된 `OperationSpec`이 실행돼요.
- [x] 요청 schema 없이 호출하면 프로젝트 설정의 payload 스키마로 JSON output을 만들어요.
- [x] API 또는 MCP 요청의 schema를 주면 그 스키마로 JSON output을 만들어요.
- [x] 프로젝트 설정에서 현재 파이프라인의 결과 컬럼과 schema 매핑 규칙을 확인할 수 있어요.
- [x] `request.filters`가 API와 MCP 결과의 행에 적용되고, 알 수 없는 필드는 오류로 알려요.
- [x] MCP로 노출한 워크플로를 MCP 클라이언트에서 `query_project` 도구로 호출할 수 있어요.
- [x] 원본 데이터 응답이 실패하면 조용히 빈 결과를 주지 않고 오류로 알려요.
- [x] API와 MCP가 배열형 `request`·`schema`와 알 수 없는 입력을 오류로 알려요.
- [x] 실행 결과가 0행, 매칭률 50% 미만, 결측률 20% 초과이면 API와 MCP가 정지 이유를 오류로 알려요.

## 실패와 정지 조건

| 감지                          | 사용자에게 보이는 것    | 진행 여부  |
| ----------------------------- | ----------------------- | ---------- |
| 원본 데이터셋 응답 실패       | 실패한 데이터셋 표시    | 오류 응답  |
| 파라미터 값이 허용 범위 밖    | 허용 범위 표시          | 오류 응답  |
| 워크플로가 정지 신호에 걸림   | 멈춘 노드 표시          | 오류 응답  |

## 결정

| 항목                 | 결정                                      |
| -------------------- | ----------------------------------------- |
| 배포 런타임과 호스팅 | Next.js route handler, 외부 데모는 ngrok   |
| 응답 형식            | `columns`, `rows`, `row_count`, `output`  |
| MCP 전송 방식        | HTTP POST JSON-RPC                        |
| 엔드포인트 주소      | 같은 origin의 `/api/deployments/:id`, `/api/mcp/:id` |
| 도구 이름            | `query_project`                           |

## 근거

- [`../product/brief.md`](../product/brief.md)
