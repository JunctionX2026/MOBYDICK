# GovData 데이터 소스 안내

경상북도 공공데이터 DuckDB와 메타데이터 RAG를 읽는 FastAPI 런타임이에요. 웹 앱은 이 앱의 HTTP API만 호출하고, DuckDB 파일을 직접 읽지 않아요.

## 실행

처음 한 번 `python3 -m venv .venv`와 `.venv/bin/pip install -r requirements.txt`를 실행해요. 데이터베이스와 검색 인덱스는 `data/`에 있어야 해요.

```bash
.venv/bin/uvicorn app.server:app --host 0.0.0.0 --port 8000
```

## 규칙

- `app/`은 선언적 `OperationSpec`만 받아 DuckDB를 계산해요.
- OpenAI Responses API 호출은 이 FastAPI 프로세스 안에서만 수행하고, API 키를 웹 앱이나 응답으로 전달하지 않아요.
- 행은 임베딩하지 않고 카탈로그 메타데이터만 검색해요.
- 데이터셋과 인덱스 대용량 파일은 Git LFS로 관리해요.
- API 키는 `.env` 또는 실행 환경에서만 읽고 저장소에 넣지 않아요.
