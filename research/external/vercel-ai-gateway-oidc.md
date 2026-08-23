# OpenAI Responses API 플래너 인증

- 검토일: 2026-08-23

## 출처

- [GPT-5.6 Luna 모델 문서](https://developers.openai.com/api/docs/models/gpt-5.6-luna)
- [Structured Outputs 문서](https://developers.openai.com/api/docs/guides/structured-outputs)
- [Vercel OIDC](https://vercel.com/docs/oidc)

## 채택

Vercel AI Gateway와 OIDC 경로를 검토했지만, 현재 데모에는 별도 Gateway가 필요하지 않아요. FastAPI가 OpenAI Responses API를 직접 호출하고 `gpt-5.6-luna`의 Structured Outputs JSON Schema를 사용해요. 결과는 JSON Schema와 `OperationSpec` 검증을 거친 뒤에만 사용해요.

## 채택하지 않음

Vercel OIDC나 별도 Gateway 토큰을 사용하지 않아요. Python AI SDK도 이번 실행 경로에 넣지 않고, FastAPI가 DuckDB와 planner 경계를 함께 관리해요. 해커톤 동안에는 외부 요청의 planner 호출을 의도적으로 허용하지만, 공개 데모가 끝나면 `GOVDATA_AI_ENABLED=false`로 끄고 FastAPI를 재시작해요.

## 로컬 근거

- `apps/govdata/app/core.py`는 FastAPI 프로세스에서만 OpenAI Responses API를 호출하고 strict JSON Schema와 DuckDB compiler를 통과시켜요.
- `apps/govdata/.env.example`은 FastAPI에만 OpenAI planner 설정을 둬요.
- `docs/LOCAL_DEVELOPMENT.md`는 FastAPI·Next.js·ngrok의 비밀값 경계를 설명해요.
