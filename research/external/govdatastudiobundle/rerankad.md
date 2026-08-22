# rerank-ad.md — 검색 리랭킹 추가·조정 매뉴얼 (개발자용)

> 대상: `app/core.py`의 조회 로직을 고도화하려는 개발자.
> 범위: **조회(retrieval) 단계만** 바꾼다. 인덱스 빌드(`4_build_index.py`, RAG)와 실행 컴파일러(`Compiler`, TAG)는 손대지 않는다.

---

## 1. 어디에 끼어드는가

현재 흐름 (`app/core.py`):

```
query
 └─ expand_query()            EN→KO 사전, 구문 사전, 한국어 동의어로 질의 확장
 └─ Catalog.search(q, k)      1차 검색
      score = 0.3·minmax(BM25) + 0.7·minmax(cos(e5))
            + 0.1·컬럼매칭 보너스 + 0.015·log10(rows)
      → argsort → top-k  (+ confidence: cosine/BM25 절대값 기반)
 └─ Catalog.multi_search()    복합 질문이면 조각별 search(part, 4) → 조각별 상위 3개
      └─ best_combo()         조각 조합 중 실측 조인율이 최대인 조합을 seed로
 └─ joinable_sets() → suggest_spec() → /api/run (DuckDB)
```

리랭커가 들어갈 자리는 **`search()` 안, argsort 직후·top-k 자르기 직전** 한 곳이다.

```
1차 점수로 후보 N개(기본 30) → 리랭커(query, doc_text) → blend → 재정렬 → top-k
```

`multi_search`는 `search`를 호출하므로 조각별 검색에도 자동 적용된다. `best_combo`, `joinable_sets`, `Compiler`는 그대로.

---

## 2. 구성 요소

### 2.1 설정 파일 `app/retrieval_config.json` (신규)

가중치를 코드에서 빼서 재시작 없이(또는 재시작만으로) 조정 가능하게 한다.

```jsonc
{
  "alpha_embed": 0.7,        // 1차: 임베딩 비중 (BM25 = 1 - alpha)
  "col_bonus": 0.1,          // 1차: 컬럼 문서 매칭 보너스
  "rows_prior": 0.015,       // 1차: log10(rows) 가중 (같은 서비스의 오퍼레이션 동점 해소)
  "part_rank1_bonus": 0.1,   // best_combo: 조각 1위 후보 유지 가산
  "rerank": {
    "enabled": true,
    "model": "BAAI/bge-reranker-v2-m3",   // 다국어 cross-encoder (한·영 혼합 질의)
    "candidates": 30,        // 1차 상위 몇 개를 리랭커에 넣을지
    "blend": 0.6,            // final = blend·rerank_norm + (1-blend)·first_norm
    "min_score": 0.2,        // 리랭커 raw sigmoid 점수가 이 미만이면 confidence=low
    "max_doc_chars": 1200    // 리랭커 입력 문서 길이 제한 (속도)
  },
  "confidence": { "high_cos": 0.87, "mid_cos": 0.84, "bm25_strong": 2 }
}
```

로드: `Catalog.__init__`에서 읽고 `self.cfg`에 보관. 파일이 없으면 위 기본값.

### 2.2 리랭커 래퍼 (신규, `app/rerank.py`)

```python
"""cross-encoder 리랭커. 지연 로드, 스레드 안전, 실패 시 None 반환(1차 점수로 폴백)."""
from __future__ import annotations
import threading
import numpy as np

class Reranker:
    def __init__(self, model: str, max_doc_chars: int = 1200):
        self.model_name, self.max_doc_chars = model, max_doc_chars
        self._m, self._lock = None, threading.Lock()

    def _load(self):
        with self._lock:
            if self._m is None:
                from sentence_transformers import CrossEncoder
                self._m = CrossEncoder(self.model_name, max_length=512)

    def score(self, query: str, docs: list[str]) -> np.ndarray | None:
        try:
            self._load()
            pairs = [(query, d[: self.max_doc_chars]) for d in docs]
            s = self._m.predict(pairs, batch_size=16, show_progress_bar=False)
            return 1 / (1 + np.exp(-np.asarray(s, dtype=np.float32)))   # sigmoid → 0~1
        except Exception:                                               # noqa: BLE001
            return None
```

- `bge-reranker-v2-m3`: 568 MB, CPU 4코어에서 30쌍 ≈ 0.3–0.6 s. 더 빠른 대안은 `BAAI/bge-reranker-base`(278 MB, 한국어 약함).
- 모델은 첫 호출 때 HF에서 1회 다운로드. 서버 기동 시 `threading.Thread(target=warm)`으로 미리 로드할 것(`server.py`의 `cat.embed("warm up")` 옆).

### 2.3 `Catalog.search` 수정 지점

```python
def search(self, q: str, k: int = 8, alpha: float | None = None, debug: bool = False) -> list[dict]:
    cfg = self.cfg
    alpha = cfg["alpha_embed"] if alpha is None else alpha
    q_exp = expand_query(q)
    ... (기존 1차 점수 계산: bm, cos, col bonus, rows prior → score)
    n = cfg["rerank"]["candidates"] if cfg["rerank"]["enabled"] else k
    cand = np.argsort(-score)[:max(n, k)]

    rr = None
    if cfg["rerank"]["enabled"] and self.reranker:
        docs = [self.ddocs[i]["text"] for i in cand]
        rr = self.reranker.score(q, docs)          # 원 질의(확장 전)를 넣는다 — 사전 확장은 BM25용
    if rr is not None:
        first = self._minmax(score[cand]); rnorm = self._minmax(rr)
        final = cfg["rerank"]["blend"] * rnorm + (1 - cfg["rerank"]["blend"]) * first
        order = cand[np.argsort(-final)][:k]
        rr_by_idx = dict(zip(cand.tolist(), rr.tolist()))
    else:
        order = cand[:k]; rr_by_idx = {}

    for i in order:
        ... (기존 out.append)
        h["rerank"] = round(rr_by_idx.get(int(i), float("nan")), 3)
        if rr_by_idx and rr_by_idx[int(i)] < cfg["rerank"]["min_score"]:
            h["confidence"] = "low"
        if debug:
            h["debug"] = {"bm25": float(bm[i]), "cosine": float(cos[i]), "first": float(score[i]),
                          "rerank": rr_by_idx.get(int(i)), "query_expanded": q_exp}
    return out
```

핵심 규칙
- **리랭커에는 확장 전 원문 질의**를 넣는다. 사전 확장(`expand_query`)은 BM25/임베딩 recall용이고, cross-encoder는 자연어 그대로가 더 정확하다.
- `blend < 1.0` 유지. 리랭커만 믿으면 BM25의 정확 일치 신호(예: 컬럼명 `cctvYN`)가 죽는다.
- 리랭커 실패(모델 미설치, OOM)는 조용히 1차 점수로 폴백하되 `debug`에 `rerank: null`을 남긴다.

### 2.4 `server.py`

- `GET /api/search?q=&k=&debug=1` → `search(q, k, debug=True)`.
- `GET /api/retrieval_config` / `PUT /api/retrieval_config` (JSON body) → `cat.cfg` 갱신 + 파일 저장. 모델명이 바뀌면 `cat.reranker = Reranker(...)`로 교체.
- `/api/stats`에 `rerank_model` 노출.

---

## 3. 평가 루프 (감이 아니라 숫자로 조정)

### 3.1 골든셋 `data/eval/golden.jsonl`

한 줄에 질문 하나. `expect`는 정답으로 인정할 `dataset_id` 목록(같은 서비스의 다른 오퍼레이션도 허용하려면 `parent`로 적는다).

```jsonl
{"q":"시군별 노인복지시설 vs 병의원","expect":["15143795"],"parent":["15000736"]}
{"q":"어린이보호구역 CCTV 설치율 낮은 시군","expect":["15143780"]}
{"q":"Yeongcheon restaurants vs pharmacies by town","expect":["ep_YeongcheonRestaurants","ep_YeongcheonPharmacy"]}
{"q":"where are EV charging stations","expect":[],"weak":true}
```

출발점: `data/qa_run4.log`의 30개 질문(이미 정답이 확인됨). 이후 데모·QA에서 틀린 질문이 나올 때마다 한 줄씩 추가.

### 3.2 `scripts/eval_retrieval.py`

```
.venv/bin/python scripts/eval_retrieval.py                 # 현재 설정
.venv/bin/python scripts/eval_retrieval.py --no-rerank     # 리랭커 끄고
.venv/bin/python scripts/eval_retrieval.py --set rerank.blend=0.4 --set alpha_embed=0.6
```

출력 지표
- **Hit@1 / Hit@3**: 정답(또는 parent)이 1위/3위 안에 있는 비율
- **MRR**: 정답 역순위 평균
- **weak 정확도**: `weak:true` 질문이 `confidence=low`로 나온 비율, 정답 있는 질문이 low로 나온 오탐 비율
- **조합 Hit**: 복합 질문에서 `best_combo`가 고른 seed 집합 ⊇ expect 인 비율 (리랭커가 조각 검색을 바꾸면 여기서 드러난다)
- p50/p95 latency

서버를 거치지 않고 `Catalog`를 직접 임포트해 돌린다(서버 락과 무관).

### 3.3 조정 순서 (권장)

1. 리랭커 끄고 baseline 기록 → 켜고 기록. Hit@1이 오르지 않으면 모델/`candidates`부터 의심.
2. `blend` 0.4 / 0.6 / 0.8 스윕. 보통 0.5–0.7이 최적.
3. `candidates` 20 / 30 / 50 — 50 이상은 지연만 늘고 이득 적음.
4. `min_score`는 weak 오탐/미탐 trade-off로 결정 (골든셋의 `weak:true` 항목 필요).
5. `part_rank1_bonus`는 조합 Hit만 보고 조정. 검색 정확도가 올라가면 이 값은 **줄여도** 된다(리랭커가 이미 1위를 잘 고르므로 조인율 우선으로 돌려줌).
6. 결정된 값은 `retrieval_config.json`에 커밋하고, 지표를 `data/eval/results.md`에 날짜와 함께 기록.

---

## 4. 절대 바꾸지 말아야 할 것

| 항목 | 이유 |
|---|---|
| `data/index/*` 생성 로직, 임베딩 모델 | 리랭킹은 인덱스 위에서 동작. 모델 교체는 별도 작업(`4_build_index.MODEL` + `Catalog.embed` 동시 변경) |
| `best_combo`의 실측 조인율 우선 원칙 (`min(rate)·matched/(matched+2)`) | 리랭커는 "무엇을 찾을지", 조합은 "무엇이 실제로 붙는지". 둘을 섞지 않는다 |
| `Compiler` / OperationSpec / `dropped_detail` | TAG 실행 계층. 검색과 독립 |
| "행은 임베딩하지 않는다" | 리랭커 입력도 `dataset_docs.json`(메타데이터)만. 샘플 값(`samples`)을 문서에 넣고 싶으면 상위 3개까지만 |

---

## 5. 체크리스트 (PR 전)

- [ ] `retrieval_config.json` 없을 때 기본값으로 기동되는가
- [ ] 리랭커 모델 미설치 상태에서 서버가 뜨고 검색이 되는가 (폴백)
- [ ] `/api/search?debug=1`에 `bm25, cosine, first, rerank, query_expanded`가 보이는가
- [ ] `eval_retrieval.py` baseline vs rerank 수치를 `data/eval/results.md`에 남겼는가
- [ ] 30개 회귀 배터리(`CLAUDE.md` 7절) 재실행: 조인 오적용 0, 의미 있는 표 ≥ 29/30 유지
- [ ] 첫 요청 지연(모델 로드)이 워밍업으로 가려지는가 (`server.py` 기동 시 스레드)
- [ ] `requirements.txt`에 추가 의존성 없음 확인 (`sentence-transformers`의 `CrossEncoder`로 충분)

---

## 6. 자주 묻는 것

**Q. 리랭커 대신 LLM으로 재정렬하면?**
가능하지만 30개 후보 × 매 질의 호출은 느리고(1–3 s) 비용이 든다. cross-encoder로 10위 안을 만들고, LLM은 `/api/plan`에서 스펙 작성에만 쓰는 현재 역할 분담이 맞다.

**Q. 한국어 전용이면 더 좋은 모델?**
`Dongjin-kr/ko-reranker`(한국어 특화, 영어 약함). 영어 질의를 버리지 않는 한 `bge-reranker-v2-m3` 권장.

**Q. 컬럼 단위 리랭킹도?**
`search`의 컬럼 보너스(`best_col`)는 BM25+코사인 혼합이다. 같은 방식으로 상위 50개 컬럼 문서를 리랭킹해 `matched_column` 정확도를 올릴 수 있지만, 지연이 두 배가 되므로 `rerank.columns: false` 옵션으로 기본 꺼 두고 필요할 때 켠다.

**Q. 동의어(폐기물/쓰레기)는 리랭커가 해결하나?**
부분적으로. cross-encoder는 문맥 유사도라 어느 정도 잡지만, 1차 후보(30개)에 들어오지 못하면 리랭커도 볼 수 없다. recall은 여전히 `KO_SYN` 사전과 임베딩 몫이고, 개념 그래프(`concept` 노드)는 별도 작업이다.
