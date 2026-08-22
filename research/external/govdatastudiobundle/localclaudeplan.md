# local-claude-plan.md — 로컬 + Claude 구독(Claude Code)으로 돌리는 개선 계획

> 전제: 개발자 PC에서 실행하고, LLM은 **Anthropic API 키가 아니라 Claude 구독(Claude Code CLI 로그인)** 으로 쓴다.
> 따라서 LLM이 필요한 모든 작업은 (a) **Claude Code 세션에서 돌리는 오프라인 배치**, (b) 서버가 **`claude -p`(headless CLI)** 를 서브프로세스로 호출하는 런타임 플래너, 둘 중 하나로 설계한다.
> 원칙은 그대로: 행은 LLM에 안 넣는다 · 조인은 실측 · LLM은 계획/설명만.

---

## 0. 구독 방식이 바꾸는 것

| 항목 | API 키 방식 | 구독(Claude Code) 방식 — 이 문서 |
|---|---|---|
| 인증 | `ANTHROPIC_API_KEY` | `claude` CLI 로그인(OAuth). 서버 코드에 키 없음 |
| 호출 | `anthropic` SDK | `subprocess.run(["claude","-p",prompt,"--output-format","json"])` |
| 비용 | 토큰 과금 | 구독 한도(5시간 단위 사용량). **대량 배치는 세션을 나눠서**, 런타임은 캐시로 호출 수 최소화 |
| 적합한 일 | 실시간 플래너 | 오프라인 배치(메타데이터 보강) + 낮은 빈도의 런타임 플래너 |
| 병렬 | 자유 | CLI 동시 실행은 2–3개까지만 (rate limit 공유) |

결론: **LLM 의존을 "빌드 타임"으로 최대한 옮기고**, 런타임은 결정적 경로(검색·조인·컴파일)가 기본, `claude -p`는 선택 기능.

---

## 1. 아키텍처

```
[빌드 타임 — Claude Code 세션에서 실행]
  catalog.json ─┬─ 5_enrich_columns.py   컬럼 한글설명·영문 gloss 보강 (빈 desc_ko 채움)
                ├─ 6_build_concepts.py   개념 노드/동의어/상위개념 → kg.json 에 concept 엣지
                └─ 7_gen_explanations.py 데모 질문·조인집합별 1문장 설명 템플릿 사전생성
  (각 스크립트는 "프롬프트 파일 생성 → claude -p 배치 호출 → JSON 검증 → 병합" 구조)

[런타임 — uvicorn, 키 없음]
  /api/recommend  검색(+리랭커) → 조인집합 → 스펙   ← LLM 없음
  /api/run        스펙 → SQL → DuckDB                 ← LLM 없음
  /api/plan       app/llm.py: backend=claude-cli → `claude -p` (캐시 적중 시 호출 없음)
  /api/explain    결과표 → 1문장 설명 (규칙 기반 기본, claude-cli 선택)
```

---

## 2. LLM 어댑터 `app/llm.py` (신규)

```python
"""LLM 백엔드 추상화. 구독 환경에서는 claude-cli 가 기본."""
from __future__ import annotations
import hashlib, json, os, shutil, subprocess, time
from pathlib import Path

CACHE = Path(__file__).resolve().parents[1] / "data" / "llm_cache"
CACHE.mkdir(parents=True, exist_ok=True)

def _key(system: str, user: str, model: str) -> str:
    return hashlib.sha256(f"{model}\n{system}\n{user}".encode()).hexdigest()[:24]

def available() -> str | None:
    if os.environ.get("ANTHROPIC_API_KEY"):
        return "api"
    if shutil.which("claude"):
        return "claude-cli"
    return None

def complete(system: str, user: str, *, model: str = "sonnet", timeout: int = 120, use_cache: bool = True) -> str:
    k = _key(system, user, model); f = CACHE / f"{k}.json"
    if use_cache and f.exists():
        return json.loads(f.read_text())["text"]
    backend = available()
    if backend == "api":
        import anthropic
        msg = anthropic.Anthropic().messages.create(model="claude-sonnet-5", max_tokens=2000, system=system,
                                                    messages=[{"role": "user", "content": user}])
        text = msg.content[0].text
    elif backend == "claude-cli":
        # --model sonnet|opus, -p = print mode(비대화), 시스템 프롬프트는 --append-system-prompt
        cmd = ["claude", "-p", user, "--model", model, "--output-format", "json",
               "--append-system-prompt", system, "--max-turns", "1"]
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout,
                           env={**os.environ, "CLAUDE_CODE_DISABLE_TOOLS": "1"})   # 도구 없이 순수 생성
        if r.returncode != 0:
            raise RuntimeError(f"claude cli failed: {r.stderr[:300]}")
        text = json.loads(r.stdout).get("result", "")
    else:
        raise RuntimeError("no LLM backend: set ANTHROPIC_API_KEY or install/login `claude`")
    f.write_text(json.dumps({"text": text, "backend": backend, "ts": time.time()}))
    return text
```

- `claude -p`는 로그인된 구독으로 과금 없이 동작한다. 첫 호출 전에 터미널에서 `claude` 한 번 실행해 로그인돼 있어야 한다.
- 호출 한 번에 1–6초. **캐시가 핵심**: 같은 (system, user) 조합은 디스크 캐시에서 즉시 반환.
- `--max-turns 1`, 도구 비활성으로 "생성만" 하게 제한. (CLI 버전에 따라 플래그명이 다를 수 있으니 `claude --help`로 확인하고 맞출 것.)
- 서버에서 동시 호출은 `threading.Semaphore(2)`로 제한.

---

## 3. 빌드 타임 배치 (Claude Code 세션에서 실행)

세 스크립트 공통 골격:

```
1) 입력 수집 (catalog.json / kg.json)      ← 결정적
2) 배치 단위로 프롬프트 생성 (JSON in)      ← 결정적
3) llm.complete() 호출, 결과 JSON 파싱      ← LLM
4) 스키마 검증 (pydantic) — 실패 배치는 재시도 1회, 그래도 실패면 skip + 로그
5) 원본에 병합, 생성 필드엔 provenance 표기 ("source": "llm:sonnet:2026-08-22")
```

배치 크기는 **프롬프트 ≤ 6k 토큰**(컬럼 40개 정도)으로. 226 데이터셋 → 약 80회 호출 → 구독 한도 안에서 한 세션에 끝남. 중간에 한도에 걸리면 캐시 덕에 재실행 시 이어서 진행된다.

### 3.1 `scripts/5_enrich_columns.py` — 컬럼 위키 보강

- 대상: `desc_ko == ""`인 컬럼(복구 데이터셋 8건 전부, 기타 빈 값) + 모든 컬럼의 **영문 gloss**(`desc_en`) — 영문 질의 검색 품질의 근본 해결.
- 입력에 주는 것: 데이터셋 제목·설명, 컬럼명, `role`, **샘플 값 3개**(행이 아니라 프로파일 샘플 — 허용 범위).
- 출력 스키마: `{"columns":[{"name":"…","desc_ko":"…","desc_en":"…","unit":"명|건|원|㎡|%|null","is_key_candidate":bool}]}`
- 병합 후 `4_build_index.py` 재실행 → `dataset_text`에 `desc_en` 포함되도록 한 줄 수정.
- 기대 효과: 영어 질의 Hit@1 상승, `unit`으로 파생 지표 자동 생성의 근거 확보.

### 3.2 `scripts/6_build_concepts.py` — 개념 그래프 (GraphRAG 식 의미 연결)

1. 컬럼 문서 2,780개 + 키워드를 e5 임베딩으로 agglomerative clustering(거리 0.35) → 후보 묶음 ~300개. **LLM 없이**.
2. 묶음별로 LLM: `{"concept":"폐기물","synonyms":["쓰레기","폐기"],"broader":"환경","members":[컬럼 id…],"reject":[묶음에 안 맞는 id]}`
3. `kg.json`에 추가: 노드 `concept:{slug}`, 엣지 `col → about → concept`, `concept → broader → concept`, `kw → same_as → concept`.
4. 검색에 연결(`core.py`): 질의 토큰이 concept/synonym에 맞으면 그 개념의 컬럼을 가진 데이터셋에 `+0.15` 가산, `matched_concept` 필드로 UI에 표시("폐기물 ← 쓰레기").
5. 조인 추천에 연결: 두 데이터셋이 같은 개념의 컬럼을 가지면 **후보**로만 제시하고, 실제 값 교집합을 `3_build_kg`의 방식으로 실측해 `joinable_by on=concept:{slug}` 엣지로 승격(매칭률 ≥0.3일 때만).

### 3.3 `scripts/7_gen_explanations.py` — 설명 템플릿 사전 생성

- 조인 집합(클리크) 상위 200개와 데모 질문 10개에 대해 "이 조합이 왜 유의미한지 1문장 + 추천 파생 지표 1개"를 생성해 `data/explanations.json`에 저장.
- 런타임 `/api/recommend`는 이 파일을 조회만 한다 → 데모 중 LLM 호출 0회.

---

## 4. 런타임 — LLM 없이 되는 개선 (먼저 할 것)

### 4.1 파생 지표 `derived`
스펙에 추가:
```json
"derived": [{"name": "cctv_rate", "expr": "100.0 * a_cctvYN_Y / a_count", "round": 1}]
```
- 파서: 토큰 = 식별자(기존 metric 이름만) | 숫자 | `+ - * /` | 괄호. 그 외는 400. 컴파일 시 `ROUND(expr, n) AS name`을 바깥 SELECT에 덧붙임. 0 나눗셈은 `NULLIF`.
- `suggest_spec`: `count_if`가 있으면 `*_rate` 자동 추가, `unit`(3.1)이 "명"인 컬럼이 둘이면 "1인당" 제안.

### 4.2 시간 키
- `3_build_kg.py`에 `ym_key()`: `2023-01`/`202301`/`2023.1`/`2023년 1월` → `2023-01`. `year`+`mt` 두 컬럼 조합도 지원(`columns:["year","mt"]`).
- KG에 `joinable_by on=ym` 엣지. 컴파일러 `key.level="ym"`.
- 효과: 포항 인구·교통·방문 시계열 60여 개가 서로 붙음 → 실측 조인 쌍 증가, "전입 vs 전출 월별" 같은 질문이 자동 조인.

### 4.3 최신 스냅샷 자동 필터
- `2_profile`에서 `time_columns`별 `max_value`를 기록.
- `suggest_spec`/`single_spec`: 시간 컬럼이 있고 질문에 "추이/월별/연도별"이 없으면 `filters`에 `time_col = max_value` 추가하고 응답에 `"as_of": "2025-12"` 포함 → UI 헤더에 "as of 2025-12".

### 4.4 양방향 매칭률
- 엣지에 `rate_a`, `rate_b`, `jaccard` 저장. `best_combo`와 UI는 `min(rate_a, rate_b)` 사용.

### 4.5 리랭커
- `docs/rerank-ad.md` 그대로. 구독과 무관(로컬 cross-encoder).

---

## 5. 런타임 — `claude -p` 플래너 (선택 기능)

`/api/plan`을 `app/llm.py`로 교체:

- 입력: 질문 + 후보 데이터셋 6개의 컬럼(이름·desc_ko·desc_en·role·unit) + **실측 joinable_sets** + OperationSpec 문법 요약.
- 출력 강제: JSON만. 파싱 실패 시 1회 재요청("JSON only"). 그래도 실패면 `suggest_spec` 결과로 폴백하고 `planner:"fallback"` 표기.
- 검증: `Compiler.compile()`이 실행 전 컬럼·agg·식을 전부 검사 → 모델이 지어낸 컬럼은 400으로 걸러지고, 그 오류 메시지를 붙여 **한 번 더** 요청(self-repair 1회).
- 캐시: 질문 문자열 정규화(소문자·공백) 기준. 데모 리허설 때 한 번 돌려 두면 본 발표에서 호출 0회.
- UI: 버튼 라벨 "Plan with Claude (local)" + 응답 시간 표시. 구독 한도 초과 시 메시지 그대로 노출하고 결정적 스펙으로 폴백.

**`/api/explain`**(신규): 실행 결과(컬럼·상위 10행·dropped_detail)만 넣어 2문장 요약. 기본은 규칙(최대·최소·평균 문장 생성), 체크박스로 LLM 켜기.

---

## 6. 구독 한도 운용 수칙

- 배치 스크립트는 `--limit N`과 `--resume`(캐시 기반)을 기본 제공. 한도에 걸리면 그냥 재실행.
- 한 배치 호출당 출력은 2k 토큰 이하로 설계(컬럼 40개 × 2문장).
- 런타임 플래너는 `Semaphore(2)` + 캐시. 데모 전 **리허설 질문을 모두 미리 실행**해 캐시 워밍.
- `data/llm_cache/`는 커밋(작고 결정성 보장). `provenance` 필드로 LLM 생성물을 구분해 실측 데이터와 섞이지 않게.
- 절대 금지: 행 데이터를 프롬프트에 넣기(샘플 3개 제외), 루프 안에서 `claude -p` 호출.

---

## 7. 실행 순서 (권장)

| 단계 | 작업 | LLM | 시간 |
|---|---|---|---|
| 1 | 골든셋 + `eval_retrieval.py` | ✗ | 1h |
| 2 | 4.1 파생 지표 + 4.2 시간 키 + 4.3 스냅샷 | ✗ | 3h |
| 3 | `app/llm.py` + `claude -p` 연결 테스트(캐시 포함) | ✓(1회) | 1h |
| 4 | 3.1 컬럼 보강(desc_ko/desc_en/unit) → 인덱스 재빌드 → 평가 비교 | ✓(~80회) | 1h + 배치 |
| 5 | 리랭커(`rerank-ad.md`) → 평가 비교 | ✗ | 1h |
| 6 | 3.2 개념 그래프 → 검색·조인 연결 → 평가 비교 | ✓(~300회, 세션 2회) | 3h |
| 7 | 5절 플래너·explain + 3.3 설명 사전생성, 리허설 캐시 워밍 | ✓ | 2h |

2단계까지만 해도 데모 질문의 비율·시계열 질문이 바로 답으로 나온다. 4·6단계가 "의미 연결(폐기물↔쓰레기)"과 영문 검색을 근본적으로 올린다.

---

## 8. 검증 기준

- 각 단계 후 `eval_retrieval.py`(Hit@1/MRR/조합 Hit)와 30개 회귀 배터리(`CLAUDE.md` 7절) 재실행, `data/eval/results.md`에 표로 누적.
- LLM 생성 필드는 **샘플 20개 수작업 검수** 후 병합(특히 `unit`과 개념 `members`의 오분류).
- `claude` 미설치 환경에서도 서버가 뜨고 `/api/plan`이 501 + 폴백 스펙을 주는지 확인.
