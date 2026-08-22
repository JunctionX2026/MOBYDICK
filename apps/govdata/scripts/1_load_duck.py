#!/usr/bin/env python3
"""
1_load_duck.py — 내려받은 CSV/XLSX를 DuckDB 한 파일로 적재
공공데이터 CSV는 CP949(EUC-KR)가 기본이고 UTF-8-SIG도 섞여 있다. 둘 다 처리한다.
테이블명은 t_{dataset_id} 로 고정 — 카탈로그/지식그래프가 이 이름으로 참조한다.
출력:
  data/gbdata.duckdb           테이블 300개 내외
  data/load_report.json        적재 결과(행 수/컬럼 수/인코딩/실패 사유)
"""
from __future__ import annotations
import json
import re
from pathlib import Path
import duckdb
import pandas as pd
ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
RAW = DATA / "raw_files"
DB = DATA / "gbdata.duckdb"
ENCODINGS = ["utf-8-sig", "cp949", "utf-8", "euc-kr"]
def read_csv_any(path: Path) -> tuple[pd.DataFrame, str]:
    last = None
    for enc in ENCODINGS:
        try:
            df = pd.read_csv(path, encoding=enc, dtype=str,
                             keep_default_na=False, on_bad_lines="skip")
            # 깨진 디코딩 휴리스틱: 헤더에 대체문자가 있으면 다음 인코딩 시도
            if any("�" in str(c) for c in df.columns):
                continue
            return df, enc
        except Exception as e:                              # noqa: BLE001
            last = e
    raise RuntimeError(f"CSV 디코딩 실패: {last}")
def clean_columns(df: pd.DataFrame) -> pd.DataFrame:
    seen: dict[str, int] = {}
    cols = []
    for c in df.columns:
        name = str(c).strip().replace("﻿", "")
        name = re.sub(r"\s+", "_", name)
        name = re.sub(r'[^0-9A-Za-z가-힣_]', "", name) or "col"
        if name[0].isdigit():
            name = "c_" + name
        if name in seen:
            seen[name] += 1
            name = f"{name}_{seen[name]}"
        else:
            seen[name] = 0
        cols.append(name)
    df.columns = cols
    return df
def main() -> None:
    files = sorted(RAW.glob("*"))
    if not files:
        raise SystemExit(f"{RAW} 가 비어 있습니다. 먼저 0_fetch_gbdata.py 를 실행하세요.")
    con = duckdb.connect(str(DB))
    report = []
    for i, path in enumerate(files, 1):
        did = path.stem
        table = f"t_{did}"
        try:
            if path.suffix.lower() in (".xlsx", ".xls"):
                df = pd.read_excel(path, dtype=str)
                enc = path.suffix.lower()
            else:
                df, enc = read_csv_any(path)
            df = df.dropna(axis=1, how="all")
            df = clean_columns(df)
            df = df.astype(str)
            con.execute(f'DROP TABLE IF EXISTS "{table}"')
            con.register("tmp_df", df)
            con.execute(f'CREATE TABLE "{table}" AS SELECT * FROM tmp_df')
            con.unregister("tmp_df")
            report.append({"id": did, "table": table, "rows": len(df),
                           "cols": len(df.columns), "encoding": enc,
                           "columns": list(df.columns), "ok": True})
        except Exception as e:                              # noqa: BLE001
            report.append({"id": did, "table": table, "ok": False,
                           "error": str(e)[:200]})
        if i % 25 == 0:
            print(f"  {i}/{len(files)}", flush=True)
    con.close()
    (DATA / "load_report.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    ok = [r for r in report if r["ok"]]
    print(f"적재 완료: {len(ok)}/{len(report)} 테이블, "
          f"총 {sum(r['rows'] for r in ok):,}행 -> {DB}")
    for r in report:
        if not r["ok"]:
            print(f"  실패 {r['id']}: {r['error'][:90]}")
if __name__ == "__main__":
    main()
