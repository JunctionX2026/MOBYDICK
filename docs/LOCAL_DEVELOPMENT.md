# 로컬 개발과 GovData 데이터 소스

웹 앱은 로컬 Next.js 서버로 실행하고, DuckDB와 RAG 인덱스는 번들의 FastAPI 서버가 읽어요. 외부에서 데모를 보여줄 때는 Next.js만 ngrok으로 공개해요.

## 처음 한 번

```bash
git lfs install
git lfs pull
python3 -m venv apps/govdata/.venv
apps/govdata/.venv/bin/pip install -r apps/govdata/requirements.txt
pnpm install
```

`sentence-transformers`가 처음 검색될 때 `intfloat/multilingual-e5-small` 모델을 내려받아요. 데이터 행은 임베딩하지 않고 카탈로그 메타데이터만 검색해요.

`apps/govdata/data/gbdata.duckdb`와 `apps/govdata/data/index/*.npy`는 Git LFS로 내려받아요. 원격 저장소의 LFS 용량과 인증이 준비되어 있어야 해요.

공공데이터 실시간 호출을 사용하려면 `apps/govdata/.env`에 포털 키와 endpoint 변수 이름을 설정해요. 실제 키 값은 커밋하지 않아요.

```bash
cp apps/govdata/.env.example apps/govdata/.env
# apps/govdata/.env에 DATA_GO_KR_KEY 값을 로컬에서 입력해요.
```

AI 플래너는 FastAPI에서만 실행해요. OpenAI API 키와 모델 설정은 `apps/govdata/.env` 또는 배포 비밀 저장소에만 둬요. 키는 웹 앱이나 브라우저에 전달하지 않아요. 공개 URL을 닫으면 `GOVDATA_AI_ENABLED=false`로 끌 수 있고, OpenAI planner를 사용할 수 없으면 검증된 결정적 추천으로 폴백해요.

## 실행

터미널을 두 개 열어요.

```bash
# 터미널 1: DuckDB/RAG 데이터 소스
cd apps/govdata
GOVDATA_AI_ENABLED=true \
GOVDATA_AI_PROVIDER=openai \
OPENAI_API_MODEL=gpt-5.6-luna \
OPENAI_REASONING_EFFORT=low \
GOVDATA_OPENAI_TIMEOUT_SECONDS=30 \
.venv/bin/uvicorn app.server:app --host 0.0.0.0 --port 8000
```

```bash
# 터미널 2: MOBYDICK 웹 앱
GOVDATA_SOURCE_URL=http://127.0.0.1:8000 \
pnpm --filter @mobydick/web exec next dev --hostname 0.0.0.0
```

웹 앱의 `데이터 소스` 노드 추가에서 프로젝트 질문에 맞는 데이터셋을 고르면 캔버스에 `datasetId`와 함께 저장해요.

## ngrok 데모

```bash
ngrok http 3000
```

ngrok은 Next.js 포트만 공개해요. 브라우저는 `/api/govdata/*`를 호출하고, Next.js 서버가 로컬 `127.0.0.1:8000`의 FastAPI로 전달해요. DuckDB 서버 포트 8000을 별도로 공개하지 않아요. 공개 URL에서 FastAPI의 OpenAI planner가 실행되므로 외부 요청마다 OpenAI 사용량이 발생할 수 있어요. API 키는 FastAPI 밖으로 전달하지 않아요.

프로젝트 상단의 `배포`에서 API 또는 MCP 주소를 만들어요. API 주소는 `POST /api/deployments/:deploymentId`에 `{"request":{...},"schema":{...}}`를 보내고, MCP 주소는 JSON-RPC `tools/call`의 `query_project`를 사용해요. `schema.properties`의 각 항목은 결과 컬럼을 `column` 또는 `from`으로 지정해 JSON 객체 목록을 만들어요.

배포용 환경 변수는 [`.env.example`](../apps/web/.env.example)의 이름만 참고해요. 비밀값은 커밋하거나 브라우저 코드에 넣지 않아요.

## 연결 확인

```bash
curl -s http://127.0.0.1:8000/api/stats
curl -s http://127.0.0.1:8000/api/live/catalog
curl -s -X POST http://127.0.0.1:8000/api/live/execute \
  -H 'content-type: application/json' \
  -d '{"service":"NMC_HOSPITAL","payload":{"Q0":"경상북도","Q1":"포항시","numOfRows":5}}'
curl -s -X POST http://127.0.0.1:8000/api/recommend \
  -H 'content-type: application/json' \
  -d '{"query":"시군별 노인복지시설 vs 병의원","k":6}'

curl -s -X POST http://localhost:3000/api/govdata/plan \
  -H 'content-type: application/json' \
  -d '{"query":"시군별 노인복지시설 vs 병의원"}'

curl -s -X POST http://localhost:3000/api/deployments/<deployment-id> \
  -H 'content-type: application/json' \
  -d '{"request":{"region":"포항시"},"schema":{"type":"object","properties":{"region":{"column":"key"}}}}'
```

데이터 소스가 꺼져 있으면 웹 앱은 빈 목록을 보여주지 않고 연결 실패 이유를 표시해요. `/api/govdata/plan`은 AI를 사용하더라도 메타데이터와 조인 가능성만 모델에 보내고, 실제 숫자 계산은 항상 DuckDB에서 수행해요.

실시간 공공데이터 API는 Next.js가 `/api/govdata/live`로 FastAPI를 프록시해요. FastAPI가 allowlist로 서비스와 오퍼레이션을 확인한 뒤 키를 주입하고, `payload`, 원본 `response`, 정규화한 `records`를 함께 반환해요. 공개 ngrok 주소에서도 호출되므로 포털 호출량과 응답 크기를 확인해요.
