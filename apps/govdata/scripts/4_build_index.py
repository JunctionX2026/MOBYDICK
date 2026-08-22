#!/usr/bin/env python3
"""
4_build_index.py — catalog.json → 검색 인덱스
  행은 임베딩하지 않는다. 데이터셋 문서(제목·설명·키워드·컬럼명·컬럼설명)와 컬럼 문서만 임베딩한다.
출력:
  data/index/dataset_docs.json   [{id, text}]
  data/index/column_docs.json    [{id, dataset_id, name, text}]
  data/index/dataset_emb.npy / column_emb.npy   (multilingual-e5-small, 정규화)
"""
from __future__ import annotations
import json
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
IDX = DATA / "index"
MODEL = "intfloat/multilingual-e5-small"


def dataset_text(ds: dict) -> str:
    cols = "; ".join(f"{c['name']}({c['desc_ko']})" if c["desc_ko"] else c["name"] for c in ds["columns"][:60])
    return " | ".join(x for x in [
        ds["title_ko"], ds.get("op_summary", ""), ds["category"], ds["provider"],
        ", ".join(ds["keywords"][:15]), (ds["description_ko"] or "")[:600], cols] if x)


def column_text(ds: dict, c: dict) -> str:
    return f"{c['name']} {c['desc_ko']} [{c['role']}] — {ds['title_ko']} ({ds['category']})"


def main() -> None:
    IDX.mkdir(parents=True, exist_ok=True)
    catalog = json.loads((DATA / "catalog.json").read_text(encoding="utf-8"))
    ddocs = [{"id": ds["dataset_id"], "text": dataset_text(ds)} for ds in catalog]
    cdocs = [{"id": f"{ds['dataset_id']}.{c['name']}", "dataset_id": ds["dataset_id"],
              "name": c["name"], "text": column_text(ds, c)}
             for ds in catalog for c in ds["columns"]]
    (IDX / "dataset_docs.json").write_text(json.dumps(ddocs, ensure_ascii=False), encoding="utf-8")
    (IDX / "column_docs.json").write_text(json.dumps(cdocs, ensure_ascii=False), encoding="utf-8")
    print(f"docs: datasets {len(ddocs)}, columns {len(cdocs)}")

    from sentence_transformers import SentenceTransformer
    m = SentenceTransformer(MODEL)
    de = m.encode(["passage: " + d["text"] for d in ddocs], normalize_embeddings=True,
                  batch_size=32, show_progress_bar=True)
    ce = m.encode(["passage: " + d["text"] for d in cdocs], normalize_embeddings=True,
                  batch_size=64, show_progress_bar=True)
    np.save(IDX / "dataset_emb.npy", de.astype(np.float32))
    np.save(IDX / "column_emb.npy", ce.astype(np.float32))
    print(f"embeddings: {de.shape} {ce.shape} -> {IDX}")


if __name__ == "__main__":
    main()
