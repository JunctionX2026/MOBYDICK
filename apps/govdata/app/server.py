"""
server.py — GovData Studio API
  GET  /api/search?q=&k=            하이브리드 검색 (데이터셋)
  POST /api/recommend {query,k}     검색 + 조인 가능 이웃 + 서로 조인되는 집합 + 기본 OperationSpec
  GET  /api/dataset/{id}            컬럼 위키
  POST /api/plan {query,schema?}    OpenAI planner가 OperationSpec을 작성하고 실행
  POST /api/run {spec}              OperationSpec → SQL → 실행 + dropped_detail
  GET  /api/stats                   발표용 수치
  GET  /api/live/catalog            허용된 공공데이터 실시간 API 목록
  POST /api/live/execute            payload → 공공데이터 API → 원본 응답 + 레코드
실행: .venv/bin/uvicorn app.server:app --host 0.0.0.0 --port 8000
"""
from __future__ import annotations

import json
import os
import threading
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException, Query as FastApiQuery
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel, Field

from .core import (
    Catalog,
    Compiler,
    _ai_enabled,
    _planner_contract_error,
    openai_plan,
    pipeline_for_spec,
    query_region,
    single_spec,
    suggest_spec,
)
from .live_api import LiveApiError, execute_live_api, live_api_catalog

ROOT = Path(__file__).resolve().parents[1]
STATIC = ROOT / "app" / "static"

# .env 로드 (로컬 FastAPI 설정)
_env = ROOT / ".env"
if _env.exists():
    for line in _env.read_text(encoding="utf-8").splitlines():
        if "=" in line and not line.strip().startswith("#"):
            k, v = line.split("=", 1)
            os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))

app = FastAPI(title="GovData Studio", version="0.1")
cat = Catalog()
comp = Compiler(cat)
threading.Thread(target=lambda: cat.embed("warm up"), daemon=True).start()


class Query(BaseModel):
    query: str
    k: int = Field(default=8, ge=1, le=20)


class RunReq(BaseModel):
    spec: dict
    output_schema: dict | None = Field(default=None, alias="schema")


class PlanReq(BaseModel):
    query: str
    output_schema: dict | None = Field(default=None, alias="schema")


class LiveExecuteReq(BaseModel):
    service: str
    operation: str | None = None
    payload: dict[str, Any] = Field(default_factory=dict)


def planning_enabled() -> bool:
    return _ai_enabled()


def fallback_plan(query: str, hits: list[dict], sets: list[dict], spec: dict | None) -> dict:
    if spec is None:
        raise HTTPException(422, "질문에 맞는 실행 가능한 OperationSpec을 찾지 못했어요.")

    return {
        "planner": "fallback",
        "title": "GovData 추천 결과",
        "explanation": "검증된 검색·조인 추천으로 실행 계획을 만들었어요.",
        "spec": spec,
    }


@app.get("/")
def index():
    return FileResponse(STATIC / "index.html")


@app.get("/api/search")
def search(q: str, k: int = FastApiQuery(default=8, ge=1, le=20)):
    return cat.search(q, k)


@app.post("/api/recommend")
def recommend(req: Query):
    import re as _re
    hits, seeds, parts = cat.multi_search(req.query, max(req.k, 8))
    ids = [h["dataset_id"] for h in hits]
    for h in hits:
        h["neighbors"] = cat.neighbors(h["dataset_id"], 0.5, 6)
    multi = len(parts) >= 2 or bool(_re.search(r"\b(join|combine|compare|together|조인|결합|비교|대비)\b", req.query, _re.I))
    prefer = "emd" if _re.search(r"\b(town|village|district|읍면동|동별|읍면별)\b", req.query, _re.I) else \
             "sgg" if _re.search(r"\b(city|county|cities|시군|시군별|시군구)\b", req.query, _re.I) else None
    sets = cat.joinable_sets(seeds[:3], ids, 0.5, 4)
    if len(seeds) >= 2:
        direct = cat.joinable_sets(seeds[:1], seeds, 0.3, 4)
        sets = [d for d in direct if set(d["members"]) >= set(seeds[:2])] + [x for x in sets if x not in direct]
    for s in sets:
        s["spec"] = suggest_spec(cat, s["members"], s["level"], s["links"], req.query)
    single = single_spec(cat, ids[0], prefer, query_region(req.query), req.query) if hits else None
    weak = bool(hits) and hits[0].get("confidence") == "low"
    # 단일 주제 질문이면 조인 집합을 자동 적용하지 않는다 (제안으로만 보여준다)
    mode = "join" if (multi and sets) else "single"
    return {"query": req.query, "parts": parts, "mode": mode, "weak_match": weak,
            "datasets": hits[:req.k], "joinable_sets": sets, "single_spec": single,
            "llm_planning": planning_enabled()}


@app.get("/api/dataset/{did}")
def dataset(did: str):
    if did not in cat.by_id:
        raise HTTPException(404, "unknown dataset")
    return cat.wiki(did)


@app.post("/api/plan")
def plan(req: PlanReq):
    import re as _re

    hits, seeds, _ = cat.multi_search(req.query, 8)
    ids = [h["dataset_id"] for h in hits]
    sets = cat.joinable_sets(seeds[:3], ids, 0.5, 4)
    if len(seeds) >= 2:
        direct = cat.joinable_sets(seeds[:1], seeds, 0.3, 4)
        sets = [d for d in direct if set(d["members"]) >= set(seeds[:2])] + [x for x in sets if x not in direct]
    for item in sets:
        item["spec"] = suggest_spec(cat, item["members"], item["level"], item["links"], req.query)

    multi = len(seeds) >= 2 or bool(_re.search(r"\b(join|combine|compare|together|조인|결합|비교|대비)\b", req.query, _re.I))
    prefer = "emd" if _re.search(r"\b(town|village|district|읍면동|동별|읍면별)\b", req.query, _re.I) else \
             "sgg" if _re.search(r"\b(city|county|cities|시군|시군별|시군구)\b", req.query, _re.I) else None
    single = single_spec(cat, ids[0], prefer, query_region(req.query), req.query) if hits else None
    deterministic = sets[0]["spec"] if multi and sets else single

    out: dict | None = None
    if planning_enabled():
        try:
            out = openai_plan(cat, req.query, hits, sets)
            contract_error = _planner_contract_error(out)
            if contract_error is not None:
                raise ValueError(f"planner contract: {contract_error}")
            out["planner"] = "openai"
        except Exception as error:                            # noqa: BLE001
            out = fallback_plan(req.query, hits, sets, deterministic)
            out["planner_error"] = str(error)
    else:
        out = fallback_plan(req.query, hits, sets, deterministic)

    if not isinstance(out, dict) or _planner_contract_error(out) is not None:
        out = fallback_plan(req.query, hits, sets, deterministic)

    try:
        contract_error = _planner_contract_error(out)
        if contract_error is not None:
            raise ValueError(f"planner contract: {contract_error}")
        comp.compile(out["spec"])
        out["pipeline"] = pipeline_for_spec(cat, out["spec"], req.query)
        out["result"] = comp.run(out["spec"], req.output_schema)
    except Exception as e:                                   # noqa: BLE001
        if deterministic is None or out.get("spec") == deterministic:
            raise HTTPException(422, f"실행 계획을 검증하지 못했어요: {e}")
        out = fallback_plan(req.query, hits, sets, deterministic)
        out["planner_error"] = f"OpenAI plan rejected: {e}"
        contract_error = _planner_contract_error(out)
        if contract_error is not None:
            raise HTTPException(422, f"fallback 계획을 검증하지 못했어요: {contract_error}")
        out["pipeline"] = pipeline_for_spec(cat, out["spec"], req.query)
        out["result"] = comp.run(out["spec"], req.output_schema)
    return out


@app.post("/api/run")
def run(req: RunReq):
    try:
        return comp.run(req.spec, req.output_schema)
    except ValueError as e:
        raise HTTPException(400, str(e))
    except Exception as e:                                   # noqa: BLE001
        raise HTTPException(400, f"execution failed: {e}")


@app.get("/api/stats")
def stats():
    pairs = sum(len(v) for v in cat.join_edges.values()) // 2
    return {"datasets": len(cat.datasets), "columns": sum(len(d["columns"]) for d in cat.datasets),
            "rows": sum(d["rows"] for d in cat.datasets), "joinable_pairs": pairs,
            "with_region_key": sum(1 for d in cat.datasets if any((d.get("region_keys") or {}).values())),
            "llm_planning": planning_enabled()}


@app.get("/api/live/catalog")
def live_catalog():
    return {"services": live_api_catalog()}


@app.post("/api/live/execute")
def live_execute(req: LiveExecuteReq):
    try:
        return execute_live_api(req.service, req.operation, req.payload)
    except LiveApiError as error:
        raise HTTPException(error.status, str(error)) from error
