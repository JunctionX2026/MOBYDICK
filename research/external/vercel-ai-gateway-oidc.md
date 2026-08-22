# Vercel AI Gateway 로컬 OIDC 인증

- 검토일: 2026-08-23

## 출처

- [AI SDK provider 선택](https://ai-sdk.dev/docs/getting-started/choosing-a-provider)
- [AI SDK AI Gateway provider](https://ai-sdk.dev/providers/ai-sdk-providers/ai-gateway)
- [Vercel OIDC](https://vercel.com/docs/oidc)
- [Codex CLI와 ChatGPT 로그인](https://help.openai.com/en/articles/11381614-api-codex-cli-and-sign-in-with-chatgpt)
- [Vercel AI SDK Python](https://github.com/vercel-labs/ai-python)

## 채택

Vercel AI Gateway와 Python AI SDK의 OIDC 경로를 검토했지만, 현재 환경에는 Gateway와 `OPENAI_API_KEY`가 없으므로 이번 해커톤 통합에서는 사용하지 않아요.

Codex ChatGPT OAuth를 사용할 때는 FastAPI가 별도의 `codex` adapter로 로컬 `codex exec --ephemeral --json --sandbox read-only`를 실행해요. 웹 앱은 `auth.json`을 읽거나 토큰을 복사하지 않고, Codex CLI가 OAuth 세션과 갱신을 관리하게 해요. 결과는 JSON 스키마와 `OperationSpec` 검증을 거친 뒤에만 사용해요.

## 채택하지 않음

Codex CLI의 ChatGPT OAuth 로그인 세션을 OpenAI API provider나 Vercel AI Gateway의 자격 증명으로 재사용하지 않아요. Codex OAuth와 Vercel OIDC는 서로 다른 발급자와 용도의 토큰이에요. Python AI SDK는 이번 실행 경로에 넣지 않고, FastAPI가 DuckDB와 planner 경계를 함께 관리해요. 해커톤 동안에는 외부 요청의 planner 호출을 의도적으로 허용하지만, 공개 데모가 끝나면 `GOVDATA_AI_ENABLED=false`로 끄고 FastAPI를 재시작해요.

## 로컬 근거

- `apps/govdata/app/core.py`는 Codex CLI를 읽기 전용 subprocess로 호출하고 strict JSON schema와 DuckDB compiler를 통과시켜요.
- `apps/govdata/.env.example`은 FastAPI에만 Codex planner 설정을 둬요.
- `docs/LOCAL_DEVELOPMENT.md`는 FastAPI·Next.js·ngrok의 비밀값 경계를 설명해요.
