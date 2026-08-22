# GovData 데이터 소스

DuckDB와 메타데이터 RAG를 제공하는 로컬 FastAPI 앱이에요. 웹 앱과 별도 포트에서 실행하고, 외부 데모에서는 Next.js 프록시 뒤에 둬요.

```bash
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/uvicorn app.server:app --host 0.0.0.0 --port 8000
```

`data/gbdata.duckdb`와 `data/index/*.npy`는 Git LFS 파일이에요. 상세한 원칙과 검증 근거는 [`../../research/external/govdatastudiobundle/`](../../research/external/govdatastudiobundle/)에 있어요.

AI planner는 `GOVDATA_AI_ENABLED=true`, `GOVDATA_AI_PROVIDER=codex`일 때 로컬 Codex CLI의 headless `codex exec`를 사용해요. Codex CLI가 같은 사용자 계정으로 ChatGPT OAuth 로그인되어 있어야 해요. FastAPI만 OAuth 세션을 사용하고 웹 앱에는 토큰을 전달하지 않아요.

## 공공데이터 실시간 API

공공데이터포털 키는 `apps/govdata/.env` 또는 프로세스 환경 변수의 `DATA_GO_KR_KEY`에 넣어요. URL을 직접 조립해야 하는 환경에서는 `DATA_GO_KR_KEY_ENCODED`를 사용할 수 있어요. 키는 FastAPI가 요청 직전에 주입하고 웹 앱과 API 응답에는 포함하지 않아요.

`GET /api/live/catalog`에서 허용된 서비스와 기본 오퍼레이션을 확인하고, `POST /api/live/execute`에 서비스·오퍼레이션·payload를 보내면 실제 포털 응답과 레코드 목록을 받아요. 서비스 URL은 서버 allowlist에 있는 값만 사용할 수 있어 임의 URL 프록시로 동작하지 않아요.

성공한 실시간 호출은 `data/live_cache/`에 인증키를 제외한 payload와 response snapshot으로 저장해요. `GOVDATA_LIVE_REPLAY=true`를 명시한 경우에만 네트워크·인증 오류에서 같은 서비스와 오퍼레이션의 snapshot을 재사용해요. 기본값은 stale 응답을 사용하지 않아요.

```bash
curl -s http://127.0.0.1:8000/api/live/catalog
curl -s -X POST http://127.0.0.1:8000/api/live/execute \
  -H 'content-type: application/json' \
  -d '{"service":"NMC_HOSPITAL","payload":{"Q0":"경상북도","Q1":"포항시","numOfRows":5}}'
```

행정안전부 인구 API는 `admmCd`, `srchFrYm`, `srchToYm`을 payload로 명시해야 해요. 버스와 병·의원 API는 오퍼레이션을 생략하면 서비스별 기본 목록 오퍼레이션을 사용해요. 웹 앱에서는 같은 기능을 `/api/govdata/live/catalog`과 `/api/govdata/live`로 호출해요.
