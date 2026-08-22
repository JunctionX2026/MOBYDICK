#!/usr/bin/env python3
"""
2_profile.py — 컬럼 위키의 본체를 만든다
각 테이블의 컬럼을 실제 값으로 프로파일링하고, 컬럼정의서(있는 175건)의 한글 설명을
병합해 catalog.json 을 만든다. 추측이 아니라 실측이라는 점이 이 파일의 존재 이유다.
핵심: role 자동 판정
  region_name  '포항시 북구', '안동시' 같은 시군구 이름
  region_code  5자리 시군구코드 / 10자리 법정동코드
  sido         광역시도
  date / year  날짜·연도
  lat / lon    좌표
  numeric      수치 (조인 대상이 아니라 분석 대상)
  code / text  나머지
출력:
  data/catalog.json   RAG 임베딩과 추천 프롬프트가 그대로 먹는 형태
"""
from __future__ import annotations
import json
import re
from collections import Counter
from pathlib import Path
import duckdb
import pandas as pd
ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
DB = DATA / "gbdata.duckdb"
GB_SGG = [
    "포항시", "경주시", "김천시", "안동시", "구미시", "영주시", "영천시", "상주시",
    "문경시", "경산시", "군위군", "의성군", "청송군", "영양군", "영덕군", "청도군",
    "고령군", "성주군", "칠곡군", "예천군", "봉화군", "울진군", "울릉군",
]
SIDO = ["서울", "부산", "대구", "인천", "광주", "대전", "울산", "세종",
        "경기", "강원", "충청", "충북", "충남", "전라", "전북", "전남",
        "경상", "경북", "경남", "제주"]
RE_CODE5 = re.compile(r"^\d{5}$")
RE_CODE10 = re.compile(r"^\d{10}$")
RE_DATE = re.compile(r"^\d{4}[-/.]?\d{2}[-/.]?\d{2}")
RE_YEAR = re.compile(r"^(19|20)\d{2}$")
RE_NUM = re.compile(r"^-?[\d,]+(\.\d+)?$")
NAME_HINT = {
    "region_code": ["시군구코드", "법정동코드", "행정동코드", "지역코드", "sggcd", "admcd", "bjdcd",
                    "signgucd", "signgu_cd", "sggcode", "ldongcd", "emdcd", "dongcode", "dong_cd", "admcode"],
    "region_name": ["시군구", "시군", "지역명", "행정구역", "시도군구", "소재지", "지자체", "읍면동", "법정동", "행정동",
                    "주소", "addr", "adres", "signgu", "sigungu", "emd", "dong", "area_nm", "areanm", "rdnmadr", "lnmadr"],
    "sido": ["시도", "광역", "ctprvn"],
    "lat": ["위도", "lat", "y좌표", "ycoord", "_la", "latitude"],
    "lon": ["경도", "lon", "lng", "x좌표", "xcoord", "_lo", "longitude"],
    "date": ["일자", "날짜", "date", "일시", "_de", "_dt", "ymd"],
    "year": ["연도", "년도", "기준연도", "year", "_yr"],
}
def guess_role(name: str, values: list[str]) -> tuple[str, float]:
    low = name.lower()
    for role, hints in NAME_HINT.items():
        if any(h in low for h in hints):
            return role, 0.7
    vals = [v for v in values if v and v != "nan"][:300]
    if not vals:
        return "text", 0.0
    n = len(vals)
    if sum(any(s in v for s in GB_SGG) for v in vals) / n > 0.5:
        return "region_name", 0.95
    if sum(bool(RE_CODE10.match(v)) for v in vals) / n > 0.8:
        return "region_code10", 0.9
    if sum(bool(RE_CODE5.match(v)) for v in vals) / n > 0.8:
        return "region_code5", 0.85
    if sum(any(v.startswith(s) for s in SIDO) for v in vals) / n > 0.7:
        return "sido", 0.8
    if sum(bool(RE_YEAR.match(v)) for v in vals) / n > 0.8:
        return "year", 0.85
    if sum(bool(RE_DATE.match(v)) for v in vals) / n > 0.7:
        return "date", 0.85
    if sum(bool(RE_NUM.match(v)) for v in vals) / n > 0.9:
        return "numeric", 0.8
    return "text", 0.3
def load_coldefs() -> dict[str, dict[str, str]]:
    """컬럼정의서(.xls/.xlsx/.csv) → {dataset_id: {항목명: 설명}}"""
    out: dict[str, dict[str, str]] = {}
    folder = DATA / "coldefs"
    if not folder.exists():
        return out
    for path in folder.glob("*"):
        did = path.stem
        try:
            if path.suffix.lower() in (".xls", ".xlsx"):
                df = pd.read_excel(path, header=None, dtype=str)
            else:
                df = pd.read_csv(path, header=None, dtype=str,
                                 encoding="cp949", on_bad_lines="skip")
            df = df.fillna("")
            hdr = 0
            for i in range(min(8, len(df))):
                row = " ".join(str(x) for x in df.iloc[i].tolist())
                if re.search(r"항목명|컬럼명|필드명", row):
                    hdr = i
                    break
            head = [str(x).strip() for x in df.iloc[hdr].tolist()]
            ni = next((j for j, h in enumerate(head)
                       if re.search(r"항목명|컬럼명|필드명", h)), 1)
            di = next((j for j, h in enumerate(head)
                       if re.search(r"설명|정의|내용|한글", h)), ni + 1)
            m = {}
            for _, r in df.iloc[hdr + 1:].iterrows():
                cells = [str(x).strip() for x in r.tolist()]
                if ni < len(cells) and cells[ni]:
                    desc = cells[di] if di < len(cells) else ""
                    m[cells[ni]] = desc[:200]
            if m:
                out[did] = m
        except Exception:                                   # noqa: BLE001
            continue
    return out
def main() -> None:
    api = json.loads((DATA / "api_catalog.json").read_text(encoding="utf-8"))
    by_id: dict[str, dict] = {}
    coldefs: dict[str, dict[str, str]] = {}
    for a in api:
        ops = a.get("operations", [])
        for op in ops:
            opid = re.sub(r"[^A-Za-z0-9]", "", op.get("operation_id") or op.get("path") or "")[:40]
            fid = f"{a['dataset_id']}_{opid}"
            keys = [fid] + ([a["dataset_id"]] if a["dataset_id"] not in by_id else [])
            entry = {
                "title_full": a.get("page_title") or a.get("title") or a.get("name", ""),
                "title": a.get("name", ""),
                "op_summary": op.get("summary", ""),
                "category": a.get("category", ""),
                "provider": a.get("org", ""),
                "keywords": a.get("keywords", []),
                "description": a.get("description", ""),
                "update_cycle": a.get("update_cycle", ""),
                "formats": ",".join(op.get("produces", [])),
                "reference": f"https://www.data.go.kr/data/{a.get('page_id')}/openapi.do" if a.get("page_id") else "",
                "registered": "",
                "endpoint": a.get("endpoint", ""),
                "api_url": op.get("full_url") or ("https://" + (a.get("host") or "").rstrip("/") + (op.get("path") or "")),
                "dataset_id": a["dataset_id"],
            }
            fields = {f["name"]: f.get("desc", "") for f in op.get("fields", []) if f.get("name")}
            for k in keys:
                by_id[k] = entry
                if fields:
                    coldefs[k] = fields
    coldefs.update(load_coldefs())
    con = duckdb.connect(str(DB), read_only=True)
    tables = [r[0] for r in con.execute("SHOW TABLES").fetchall()]
    catalog = []
    for i, table in enumerate(sorted(tables), 1):
        did = table[2:]
        meta = by_id.get(did, {})
        try:
            df = con.execute(f'SELECT * FROM "{table}" LIMIT 500').fetchdf()
            nrows = con.execute(f'SELECT COUNT(*) FROM "{table}"').fetchone()[0]
        except Exception:                                   # noqa: BLE001
            continue
        defs = coldefs.get(did, {})
        cols = []
        for c in df.columns:
            vals = [str(v) for v in df[c].tolist()]
            nonnull = [v for v in vals if v and v.lower() != "nan"]
            role, conf = guess_role(c, vals)
            defs_l = {k.lower(): v for k, v in defs.items()}
            desc = defs.get(c) or defs.get(c.replace("_", " ")) or defs_l.get(c.lower()) \
                or defs_l.get(c.split("_")[-1].lower()) or ""
            samples = [v for v, _ in Counter(nonnull).most_common(3)]
            cols.append({
                "name": c,
                "role": role,
                "role_confidence": round(conf, 2),
                "desc_ko": desc,
                "null_rate": round(1 - len(nonnull) / max(len(vals), 1), 3),
                "distinct_sample": len(set(nonnull)),
                "samples": samples,
            })
        region_cols = [c["name"] for c in cols
                       if c["role"].startswith("region") or c["role"] == "sido"]
        time_cols = [c["name"] for c in cols if c["role"] in ("year", "date")]
        num_cols = [c["name"] for c in cols if c["role"] == "numeric"]
        catalog.append({
            "dataset_id": did,
            "table": table,
            "title_ko": meta.get("title_full") or meta.get("title", ""),
            "op_summary": meta.get("op_summary", ""),
            "parent_dataset_id": meta.get("dataset_id", did),
            "api_url": meta.get("api_url", ""),
            "category": meta.get("category", ""),
            "provider": meta.get("provider", ""),
            "keywords": meta.get("keywords", []),
            "description_ko": (meta.get("description", "") or "")[:1500],
            "update_cycle": meta.get("update_cycle", ""),
            "formats": meta.get("formats", ""),
            "reference": meta.get("reference", ""),
            "registered": meta.get("registered", ""),
            "rows": nrows,
            "columns": cols,
            "region_columns": region_cols,
            "time_columns": time_cols,
            "numeric_columns": num_cols,
            "has_coldef": did in coldefs,
            "status": "verified",     # 실제 데이터로 프로파일링됨
        })
        if i % 25 == 0:
            print(f"  {i}/{len(tables)}", flush=True)
    con.close()
    (DATA / "catalog.json").write_text(
        json.dumps(catalog, ensure_ascii=False, indent=2), encoding="utf-8")
    total_cols = sum(len(c["columns"]) for c in catalog)
    with_region = sum(1 for c in catalog if c["region_columns"])
    with_time = sum(1 for c in catalog if c["time_columns"])
    print(f"\ncatalog.json 저장: 데이터셋 {len(catalog)}건 / 컬럼 {total_cols:,}개")
    print(f"  지역 컬럼 보유 {with_region}건, 시간 컬럼 보유 {with_time}건")
    print(f"  컬럼정의서 병합 {sum(1 for c in catalog if c['has_coldef'])}건")
if __name__ == "__main__":
    main()
