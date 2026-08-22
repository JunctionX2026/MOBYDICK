# CLAUDE.md — GovData Studio 개발 매뉴얼

> 이 파일은 Claude Code(및 사람 개발자)가 이 저장소에서 작업할 때 읽는 매뉴얼이다.
> 프로젝트: JunctionX Korea 2026 · Team 44 · **GovData Studio (Gyeongbuk edition)**
> 한 줄: *Find, combine, and run Korean public data — column by column.*

---

## 0. 30초 요약

- 경북 공공데이터 **226개 데이터셋**(data.go.kr API)을 **DuckDB 한 파일**에 넣고,
  컬럼 위키(한글 설명·role·샘플)와 **실측 조인 그래프**(어떤 데이터끼리 실제로 붙는지 매칭률)를 만들었다.
- 위에 FastAPI + 영문 단일 페이지 UI가 올라가 있다: 질문 → 데이터셋·조인집합 추천 → **OperationSpec(JSON)** → DuckDB SQL 컴파일·실행 → 표/차트/탈락 키.
- **설계 원칙 3개 (절대 지킬 것)**
  1. **행은 임베딩하지 않는다.** 메타데이터(제목·설명·컬럼명·컬럼설명)만 검색 대상. 행은 DuckDB에서 SQL로 계산.
  2. **조인 가능성은 추측이 아니라 실측.** `kg.json`의 `joinable_by` 엣지는 키 교집합을 실제로 센 결과다. LLM이 "붙을 것 같다"고 말하게 하지 말 것.
  3. **LLM은 계획만, 계산은 DB가.** LLM(있다면)은 OperationSpec만 쓰고, 숫자는 전부 DuckDB가 낸다.

---

## 1. 디렉터리 구조

```
duckragtag/
├── .env                      DATA_GO_KR_KEY / DATA_GO_KR_KEY_ENCODED (+ 선택 ANTHROPIC_API_KEY). 커밋 금지
├── .venv/                    Python 3.9 venv. 항상 .venv/bin/python 으로 실행
├── requirements.txt
├── README.md                 사용자용 소개 / CLAUDE.md 이 파일
├── scripts/                  데이터 파이프라인 (번호 순서대로 실행)
│   ├── 0_resolve_datago.py   endpoints.csv → data.go.kr 상세페이지 → api_catalog.json (오퍼레이션·파라미터·필드 한글설명)
│   ├── 1_fetch_api.py        api_catalog.json → 실제 API 호출 → data/raw_files/*.csv, fetch_report.json
│   ├── 1_load_duck.py        raw_files → data/gbdata.duckdb (테이블 t_{dataset_id}), load_report.json
│   ├── 2_profile.py          DuckDB 실값 프로파일링 + Swagger 필드설명 병합 → data/catalog.json (컬럼 위키)
│   ├── 3_build_kg.py         지역 키 정규화(sgg/emd) → 교집합 실측 → data/kg.json, joinable_pairs.csv
│   └── 4_build_index.py      catalog.json → BM25 + e5 임베딩 → data/index/
├── app/
│   ├── core.py               Catalog(검색·그래프) / Compiler(OperationSpec→SQL) / suggest_spec / single_spec / llm_plan
│   ├── server.py             FastAPI 라우트
│   └── static/index.html     영문 UI (의존성 없는 단일 HTML, inline SVG 차트)
├── data/                     산출물 (대용량은 .gitignore)
│   ├── endpoints.csv         입력: 기관,데이터명,End Point (246행, 사용자가 준 목록)
│   ├── api_catalog.json      0단계 결과
│   ├── raw_files/            1단계 결과 (gitignore)
│   ├── gbdata.duckdb         적재 결과 (gitignore, 89MB)
│   ├── catalog.json          ★ 컬럼 위키 — RAG/추천/컴파일러가 전부 이걸 본다
│   ├── kg.json               ★ 지식그래프 (has_column / topic_of / tagged / joinable_by)
│   ├── joinable_pairs.csv    발표용 조인 쌍 표
│   ├── index/                검색 인덱스 (*.npy 는 gitignore)
│   ├── demo_questions.md     검증된 데모 질문 10개 + SQL
│   ├── qa_report.md          30개 질문 QA 결과·수정 내역·남은 한계
│   └── *_report.json / *.log 수집·적재 결과와 실패 사유 (버리지 말 것)
└── dist/govdata-studio-bundle.tar.gz   다른 PC로 옮기는 번들 (app+scripts+duckdb+catalog+kg+index)
```

---

## 2. 실행 명령 치트시트

```bash
# 서버 (UI: http://localhost:8000)
.venv/bin/uvicorn app.server:app --host 127.0.0.1 --port 8000
# 백그라운드
nohup .venv/bin/uvicorn app.server:app --host 127.0.0.1 --port 8000 > data/server.log 2>&1 &

# 서버 종료 — 반드시 포트로 찾아서 kill. `pkill -f uvicorn` 은 Claude Code 의 셸까지 죽인다(exit 144).
pids=$(ss -ltnp | grep ':8000 ' | grep -oE 'pid=[0-9]+' | cut -d= -f2 | sort -u); for p in $pids; do kill $p; done

# 파이프라인 전체 재빌드 (서버를 먼저 내려야 한다 — DuckDB 파일 락)
.venv/bin/python scripts/1_load_duck.py
.venv/bin/python scripts/2_profile.py
.venv/bin/python scripts/3_build_kg.py
.venv/bin/python scripts/4_build_index.py

# 데이터 재수집 (이미 받은 파일은 건너뜀. 특정 id만: 인자로 dataset_id 나열)
.venv/bin/python scripts/1_fetch_api.py
.venv/bin/python scripts/1_fetch_api.py 15143795 ep_YeongcheonPharmacy

# 카탈로그 재해석 (data.go.kr 페이지 캐시는 data/datago_pages/ 에 있음)
.venv/bin/python scripts/0_resolve_datago.py

# 스모크 테스트
curl -s localhost:8000/api/stats
curl -s -X POST localhost:8000/api/recommend -H 'content-type: application/json' -d '{"query":"시군별 노인복지시설 vs 병의원"}'
```

**순서 규칙**: 서버 내리기 → `1_load_duck` → `2_profile` → `3_build_kg` → `4_build_index` → 서버 올리기.
`2_profile`이 `catalog.json`을 다시 쓰고, `3_build_kg`가 거기에 `region_keys`/`default_sgg`를 덧붙인다. 순서를 바꾸면 `default_sgg`가 사라져 읍면동 조인이 깨진다.

---

## 3. 핵심 키 규칙 (바꾸지 말 것)

| 개념 | 값 | 예 |
|---|---|---|
| `dataset_id` | data.go.kr 페이지 id. 오퍼레이션이 여러 개면 `{page_id}_{operationId}`. 패턴 추론으로 복구한 건 `ep_{serviceName}` | `15143795`, `15000736_getHsptlMdcncListInfoInqire`, `ep_YeongcheonPharmacy` |
| 원본 파일 | `data/raw_files/{dataset_id}.csv` (utf-8-sig) | |
| DuckDB 테이블 | `t_{dataset_id}` — **모든 컬럼 VARCHAR** (숫자는 SQL에서 `TRY_CAST`) | `t_15143795` |
| 카탈로그 | `catalog.json[*].dataset_id`, `.table` | |
| 그래프 노드 | `ds:{dataset_id}`, `col:{dataset_id}.{column}`, `topic:{분류}`, `kw:{키워드}` | |
| 조인 수준 | `sgg` = 시군구(23개 중 군위군 제외 22), `emd` = `"{시군}|{읍면동}"`, `raw` = 값 그대로 | `포항시`, `영천시|금호읍` |

컬럼명은 `1_load_duck.clean_columns`가 정리한 이름(공백→`_`, 특수문자 제거, 숫자 시작은 `c_`)이다. 원본 API 필드명과 대소문자가 같으니 Swagger 설명과 1:1로 붙는다.

---

## 4. 데이터 계약 (스키마)

### 4.1 `catalog.json` — 데이터셋 1건
```jsonc
{
  "dataset_id": "15143795", "table": "t_15143795",
  "parent_dataset_id": "15143795",        // 같은 서비스의 오퍼레이션끼리 묶는 키 (자기조인 방지)
  "title_ko": "경상북도_노인복지시설 현황조회", "op_summary": "노인복지시설 목록 조회",
  "category": "사회복지 - 노인", "provider": "경상북도 본청", "keywords": [...],
  "description_ko": "...", "update_cycle": "", "reference": "https://www.data.go.kr/data/15143795/openapi.do",
  "api_url": "https://apis.data.go.kr/6470000/GbHappyMap/...", "rows": 1235,
  "columns": [ { "name": "fcltAddr", "role": "region_name", "role_confidence": 0.7,
                 "desc_ko": "시설 주소", "null_rate": 0.0, "distinct_sample": 480,
                 "samples": ["경상북도 포항시 ...", ...] }, ... ],
  "region_columns": [...], "time_columns": [...], "numeric_columns": [...],
  "region_keys": { "sgg": "fcltAddr", "emd": "fcltAddr" },   // 3_build_kg 가 채움. 조인에 쓸 컬럼
  "default_sgg": null,                                       // 단일 시군 데이터셋이면 "포항시" 등
  "has_coldef": true, "status": "verified"
}
```
`role` 값: `region_name | region_code | region_code5 | region_code10 | sido | lat | lon | date | year | numeric | text`.
role은 `2_profile.guess_role`이 **컬럼명 힌트(NAME_HINT) → 실값 패턴** 순으로 판정한다. 새 컬럼명 패턴이 보이면 `NAME_HINT`에 추가.

### 4.2 `kg.json`
```jsonc
{ "nodes": [ {"id":"ds:…","type":"dataset",…}, {"id":"col:…","type":"column","role":…,"desc":…} ],
  "edges": [ {"s":"ds:A","p":"has_column","o":"col:A.x"},
             {"s":"ds:A","p":"topic_of","o":"topic:보건"},
             {"s":"ds:A","p":"tagged","o":"kw:병원"},
             {"s":"ds:A","p":"joinable_by","o":"ds:B","on":"sgg","a_col":"addr","b_col":"dutyAddr",
              "matched":22,"match_rate":1.0} ] }
```
`match_rate = |A∩B| / min(|A|,|B|)`, `MIN_MATCH=0.30`, `MIN_KEYS=3`. 같은 `parent_dataset_id`끼리는 엣지 없음.

### 4.3 OperationSpec (`/api/run` 입력) — **이 프로젝트의 유일한 실행 언어**
```jsonc
{
  "sources": [
    { "alias": "a", "dataset_id": "15143795",
      "key": { "column": "fcltAddr", "level": "sgg" },          // sgg | emd | raw. 조인하려면 모든 소스에 필요
      "filters": [ { "column": "fcltTypNm", "op": "like", "value": "%요양%" } ],
      "metrics": [ { "name": "welfare", "agg": "count", "column": "*" },
                   { "name": "cap", "agg": "sum", "column": "psncpa" },
                   { "name": "with_cctv", "agg": "count_if", "column": "cctvYN", "value": "Y" } ],
      "group_by": [] },                                          // 키 외 추가 그룹 컬럼(선택)
    { "alias": "b", "dataset_id": "15000736_getHsptlMdcncListInfoInqire",
      "key": { "column": "dutyAddr", "level": "sgg" },
      "metrics": [ { "name": "hospitals", "agg": "count", "column": "*" } ] }
  ],
  "join": "inner",                       // inner | left (첫 소스 기준)
  "order_by": [ { "name": "welfare", "desc": true } ],
  "limit": 50
}
```
- `agg`: `count | sum | avg | min | max | count_distinct | count_if(value)`. sum/avg/min/max는 `TRY_CAST(REPLACE(col,',','') AS DOUBLE)`.
- `op`: `= != > < >= <= like in`. 비교 연산은 DOUBLE 캐스팅, 나머지는 문자열. 값은 전부 **바인드 파라미터**(SQL 인젝션 불가). 식별자는 `[0-9A-Za-z가-힣_]+`만 허용.
- 소스가 1개면 조인 없이 집계(키 NULL 행 제외). `"columns": [...]`만 주고 metrics를 비우면 **원시 행** 반환(지역 키 없는 wide 테이블용).
- `level: emd`는 데이터셋의 `default_sgg`가 있으면 `emd2(col, '포항시')`로 컴파일돼 `'장량동'` 같은 값에도 시군이 붙는다.
- 응답: `{sql, params, columns, rows, row_count, sources, dropped_detail:[{alias,title,keys,matched,match_rate,dropped,dropped_keys[≤30]}]}`.
  **`dropped_detail`은 항상 UI에 보여준다** — "붙을 것 같다"가 아니라 "22/25 붙었고 군위·울릉이 빠졌다"가 이 제품의 차별점.

---

## 5. API

| 메서드·경로 | 입력 | 출력 요점 |
|---|---|---|
| `GET /api/stats` | — | datasets/columns/rows/joinable_pairs/with_region_key/llm_planning |
| `GET /api/search?q=&k=` | | 데이터셋 목록 + `score, cosine, bm25, confidence(high/medium/low), matched_column` |
| `POST /api/recommend` | `{query, k}` | `parts`(질문 조각), `mode`(`join`/`single`), `weak_match`, `datasets[+neighbors]`, `joinable_sets[{level, members, titles, min_match_rate, links, spec}]`, `single_spec` |
| `POST /api/run` | `{spec}` | 4.3 참조. 400 = 스펙 오류(메시지에 이유) |
| `POST /api/plan` | `{query}` | `ANTHROPIC_API_KEY` 없으면 501. 있으면 Claude(`claude-sonnet-5`)가 `{spec, explanation, title}` 작성 후 바로 실행해 `result` 동봉 |
| `GET /api/dataset/{id}` | | 컬럼 위키 전체 + 실측 이웃(`neighbors`) |

**추천 흐름 (`core.py`)**
1. `split_query`: `,` `/` `vs` `and` `with` 등으로 조각내고 `by city/town` 접미 제거, 앞의 지역명은 전 조각에 전파.
2. `expand_query`: EN→KO 단어 사전(`EN_KO`, ~200) + 구문 사전(`EN_KO_PHRASE`) + 한국어 동의어(`KO_SYN`)를 질의에 덧붙임.
3. `search`: `0.3·BM25 + 0.7·cosine(e5)` + 컬럼 매칭 보너스 0.1 + 행수 prior `0.015·log10(rows)`.
4. `multi_search` → `best_combo`: 조각별 상위 3개의 조합 중 **`min(match_rate) × matched/(matched+2)`** 최대 조합을 seed로. `by city`→sgg, `by town`→emd 선호.
5. `joinable_sets`: seed를 포함하고 후보 안에서 같은 수준으로 전부 붙는 집합(탐욕 클리크, ≤4개).
6. 조각이 2개 이상이거나 `vs/compare/비교/결합` 등이 있을 때만 `mode=join`; 아니면 `single_spec`(단일 시군 데이터셋은 emd, 광역은 sgg; 질문에 시군이 있으면 LIKE 필터).
7. `suggest_spec`: 소스마다 `count` + 첫 "좋은" 수치 컬럼(`co/cnt/nmpr/popltn/ar/cpcty…` 우선, `no/id/cd/la/lo/…` 제외) `sum`(밀도·비율은 `avg`) + Y/N 컬럼 `count_if`.

---

## 6. 자주 하는 작업 — 레시피

### 6.1 검색이 엉뚱한 데이터셋을 고른다
1. `data/qa_run4.log` 방식으로 재현: `/api/recommend`의 `parts`, `datasets[0].confidence/cosine/bm25` 확인.
2. 영어 단어면 `app/core.py`의 `EN_KO`(단어) 또는 `EN_KO_PHRASE`(구문)에 추가. 한국어 표기 변형이면 `KO_SYN`.
3. 같은 서비스의 다른 오퍼레이션이 뽑히면 행수 prior가 작동하는지 확인(`rows`).
4. 질문 시군과 데이터셋 시군이 다르면 `confidence=low`가 되는 게 정상(`query_region` + `default_sgg`).
5. 서버 재시작만 하면 반영 (인덱스 재빌드 불필요 — 사전은 질의 쪽에만 적용).

### 6.2 조인이 안 잡힌다 / 읍면동 키가 없다
- `3_build_kg.py`의 `sgg_key` / `emd_key`를 REPL에서 직접 테스트:
  ```python
  import sys; sys.path.insert(0,'scripts'); import importlib; kg=importlib.import_module('3_build_kg')
  kg.sgg_key('경상북도 포항시 북구 중앙로 1'), kg.emd_key('장량동', '포항시')
  ```
- 값 형식이 새로우면 정규식(`SGG_RE`, `STEM_RE`, `emd_key`의 읍면동 토큰 패턴) 보강 → `3_build_kg` 재실행(서버 내릴 필요 없음: read_only) → 서버 재시작.
- 코드형 키(5/10자리)는 `SGG_CODE` 표로 시군 이름에 매핑된다. 새 코드는 거기 추가.

### 6.3 데이터셋 추가
1. `data/endpoints.csv`에 행 추가 → `0_resolve_datago.py`(캐시돼 있어 새 행만 네트워크).
2. 페이지를 못 찾으면(`match: none/title`) `api_catalog.json`에 수동으로 `match:"host"`, `host`, `operations[{path, full_url, operation_id, summary}]` 추가하고 `dataset_id`는 `ep_{service}`로. (형제 서비스 패턴: 영천 `/getResult`, 포항 `/get{Name}`, 경북본청 `/{name}`)
3. `1_fetch_api.py <dataset_id>` → 서버 내리고 `1_load_duck → 2_profile → 3_build_kg → 4_build_index` → 서버 올리기.
4. 실패는 `fetch_report.json`에 사유가 남는다. **조용히 버리지 말 것.** 알려진 실패: 안동시 자체 서버(`NO OPENAPI SERVICE`, 키 미승인), TAGO 버스(노선·정류장 파라미터 필수), 구미 도서관·상주 대금지급(폐기), 전통시장·협동조합(0건 반환).

### 6.4 새 집계/연산 추가
- `Compiler.AGG`에 이름 추가 + `_metric_sql`에 SQL 생성 분기. 값은 항상 파라미터 바인딩 또는 `'`-이스케이프.
- 파생 지표(비율 등)가 필요하면 스펙에 `"expr"`를 추가하는 방식보다 **두 metric을 받아 UI/후처리에서 나누는 편**이 안전하다(SQL 인젝션 면적 유지).

### 6.5 LLM 플래너 켜기
- `.env`에 `ANTHROPIC_API_KEY=...` → 서버 재시작 → UI의 "Plan with Claude" 활성.
- 프롬프트는 `core.PLAN_SYSTEM`. 후보 데이터셋의 컬럼(이름·설명·role)과 **실측 joinable_sets**를 함께 넘긴다. 모델이 없는 컬럼을 지어내면 `Compiler`가 `column 'x' not in dataset` 400으로 거른다 — 이게 의도된 안전장치.

### 6.6 다른 PC로 옮기기
- `dist/govdata-studio-bundle.tar.gz` 풀기 → `python3 -m venv .venv && .venv/bin/pip install -r requirements.txt`(torch는 CPU 휠 `--extra-index-url https://download.pytorch.org/whl/cpu`) → uvicorn.
- DuckDB 파일은 OS/CPU 무관, **DuckDB 1.4.x**면 열린다(`requirements.txt`에 `duckdb>=1.4,<1.5`). 첫 검색 때 `intfloat/multilingual-e5-small`(~470MB)을 HF에서 1회 내려받는다.
- 번들 재생성: `tar czf dist/govdata-studio-bundle.tar.gz --exclude='__pycache__' app scripts README.md requirements.txt data/gbdata.duckdb data/catalog.json data/kg.json data/api_catalog.json data/index data/joinable_pairs.csv data/demo_questions.md data/qa_report.md data/endpoints.csv data/fetch_report.json data/load_report.json`

---

## 7. 테스트 방법 (검증 없이 "됐다"고 하지 말 것)

- **회귀 배터리**: `data/qa_run4.log`를 만든 스크립트 패턴(30개 질문을 `/api/recommend → /api/run`으로 실행, `mode / top / set / rows / drop` 출력). 변경 후 반드시 돌리고 run4와 비교. 기대치: 28/30 올바른 1위, 조인 오적용 0, 의미 있는 표 29/30.
- **데모 질문 10개**: `data/demo_questions.md`의 SQL을 DuckDB에서 직접 실행해 행 수가 나오는지.
- **컴파일러 단위**: 잘못된 컬럼/식별자/agg가 400으로 떨어지는지, `dropped_detail` 합이 맞는지.
- 배터리 실행은 서버가 떠 있어야 한다(첫 요청은 모델 로드로 ~8s, 이후 0.1–0.4s).

---

## 8. 함정 모음

| 함정 | 대응 |
|---|---|
| `pkill -f uvicorn` → Claude Code 셸이 함께 죽음(exit 144) | 2절의 포트 기반 kill 사용 |
| `1_load_duck.py` 실행 중 `Could not set lock on file` | 서버가 DB를 열고 있음. 먼저 내릴 것 |
| `2_profile.py` 이후 읍면동 조인이 사라짐 | `3_build_kg.py`를 다시 돌려 `region_keys`/`default_sgg` 채우기 |
| `gbdata.kr`(GB모아) 접속 타임아웃 | 이 OCI 인스턴스 IP가 차단됨. 이 프로젝트는 data.go.kr로 전환했으니 재시도 금지 |
| 영문 질의가 엉뚱함 | 소형 e5는 교차언어가 약함 → 사전(`EN_KO*`)에 단어 추가가 정답. 모델 교체는 `4_build_index.MODEL`과 `Catalog.embed` 둘 다 바꿔야 함 |
| `match_rate` 1.0인데 결과가 3행 | 분모가 작은 테이블. `dropped_detail`의 `keys`를 보고 판단. `best_combo`는 이미 `matched/(matched+2)`로 할인 |
| 숫자가 이상함(음수 합계 등) | 원본 API의 센티널(-999 등). 모든 컬럼이 VARCHAR라 `TRY_CAST` 후 필터 필요 |
| DuckDB UDF에 NULL | `create_function(..., null_handling="special")` 필수(이미 적용) |
| 발표 문구 | "302개 API 지원" 같은 과장 금지. 정확히: **"경북 공공데이터 246건 중 226건을 적재해 2,106쌍의 조인을 실측 검증"** |

---

## 9. 하지 말 것

- 행(레코드)을 임베딩하거나 LLM에 통째로 넘기기
- 컬럼 의미를 LLM으로 "추정"해 `catalog.json`에 채우기 (Swagger 설명·실값 프로파일만)
- `dataset_id`/테이블명 규칙 변경, `data/*_report.json` 삭제
- API 호출 `WORKERS=4`, `DELAY=0.15` 올리기 (지자체 서버)
- 서버를 `0.0.0.0`으로 열거나 방화벽 포트를 사용자 확인 없이 열기
- `.env`, `raw_files/`, `gbdata.duckdb` 커밋
