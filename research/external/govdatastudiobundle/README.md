# GovData Studio — Gyeongbuk edition

*Find, combine, and run Korean public data — column by column.*

218 Gyeongbuk public datasets (data.go.kr APIs) loaded into DuckDB, a column wiki with Korean field
descriptions, and a knowledge graph whose `joinable_by` edges are **measured** (key intersection), not guessed.
The LLM only plans; DuckDB computes.

## Run on your PC

```bash
git clone <repo> && cd duckragtag
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt   # torch CPU wheel: add --extra-index-url https://download.pytorch.org/whl/cpu
# copy the data bundle (gbdata.duckdb, catalog.json, kg.json, index/) into ./data
.venv/bin/uvicorn app.server:app --host 0.0.0.0 --port 8000
# open http://localhost:8000
```

First search downloads `intfloat/multilingual-e5-small` (~470 MB) from Hugging Face once.
Put `ANTHROPIC_API_KEY=...` in `.env` to enable **Plan with Claude**; everything else works without it.

## Pipeline (rebuild from scratch, ~15 min)

| step | script | output |
|---|---|---|
| 0 | `scripts/0_resolve_datago.py` | `data/api_catalog.json` — operations, params, Korean field descriptions (from data.go.kr Swagger) |
| 1 | `scripts/1_fetch_api.py` | `data/raw_files/*.csv` — real rows (20k cap per op), `fetch_report.json` |
| 1b | `scripts/1_load_duck.py` | `data/gbdata.duckdb` — table `t_{dataset_id}` |
| 2 | `scripts/2_profile.py` | `data/catalog.json` — column roles, samples, descriptions |
| 3 | `scripts/3_build_kg.py` | `data/kg.json`, `data/joinable_pairs.csv` — measured joins at 시군구 (`sgg`) and 읍면동 (`emd`) |
| 4 | `scripts/4_build_index.py` | `data/index/` — BM25 + e5 embeddings of metadata only |

Needs `.env` with `DATA_GO_KR_KEY` / `DATA_GO_KR_KEY_ENCODED` and `data/endpoints.csv`.

## API

| endpoint | what |
|---|---|
| `POST /api/recommend {query}` | hybrid search → datasets, measured joinable neighbors, joinable sets, ready-to-run spec |
| `POST /api/run {spec}` | OperationSpec → SQL → rows + `dropped_detail` (which keys fell out of the join, per side) |
| `POST /api/plan {query}` | Claude writes the OperationSpec (needs API key), then runs it |
| `GET /api/dataset/{id}` | column wiki + measured joins |
| `GET /api/stats` | headline numbers |

### OperationSpec

```json
{"sources": [
   {"alias": "a", "dataset_id": "15143795", "key": {"column": "fcltAddr", "level": "sgg"},
    "filters": [], "metrics": [{"name": "welfare", "agg": "count", "column": "*"}]},
   {"alias": "b", "dataset_id": "15000736_getHsptlMdcncListInfoInqire", "key": {"column": "dutyAddr", "level": "sgg"},
    "metrics": [{"name": "hospitals", "agg": "count", "column": "*"}]}],
 "join": "inner", "order_by": [{"name": "welfare", "desc": true}], "limit": 50}
```

`level`: `sgg` (시군구), `emd` (읍면동), `raw` (exact value, e.g. year+month). A source with `"columns": [...]` and no
metrics returns raw rows. `agg`: count | sum | avg | min | max | count_distinct. Filter ops: `= != > < >= <= like in`.

## Files for the talk

- `data/joinable_pairs.csv` — every measured pair with titles, categories, match rate, sample dropped keys
- `data/demo_questions.md` — 10 verified demo questions with SQL
