#!/usr/bin/env python3
"""
3_build_kg.py — 조인 가능성을 '추측'이 아니라 '실측'해서 지식그래프를 만든다

지역 키를 두 수준으로 정규화한다.
  sgg : 시군구  — '경상북도 포항시 북구 …' / '포항북구' / '47111' / '4711110100' -> '포항시'
  emd : 읍면동  — '경상북도 영천시 금호읍 …' -> '영천시|금호읍'   (단일 시군 데이터셋끼리의 조인 근거)
각 수준에서 두 테이블의 키 교집합을 세고 match_rate 를 기록한다.

출력:
  data/kg.json            노드/엣지 (has_column, topic_of, tagged, joinable_by{level})
  data/joinable_pairs.csv 발표 슬라이드용 표 (매칭률 내림차순)
"""
from __future__ import annotations
import csv
import json
import re
from itertools import combinations
from pathlib import Path

import duckdb

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
DB = DATA / "gbdata.duckdb"
MIN_MATCH = 0.30
MIN_KEYS = {"sgg": 3, "emd": 3}

GB_SGG = ["포항시", "경주시", "김천시", "안동시", "구미시", "영주시", "영천시", "상주시",
          "문경시", "경산시", "군위군", "의성군", "청송군", "영양군", "영덕군", "청도군",
          "고령군", "성주군", "칠곡군", "예천군", "봉화군", "울진군", "울릉군"]
SGG_RE = re.compile("(" + "|".join(GB_SGG) + ")")
# '포항' 처럼 시/군 접미사가 빠진 경우
SGG_STEM = {s[:-1]: s for s in GB_SGG}
STEM_RE = re.compile("(" + "|".join(SGG_STEM) + ")(?![시군])")
EMD_RE = re.compile(r"([가-힣]{1,6}(?:읍|면|동|리|가))\b|([가-힣]{1,6}(?:읍|면|동))(?=\s|$|\d)")
# 경북 시군구코드 (법정동코드 앞 5자리) — 포항은 남구/북구 2개
SGG_CODE = {
    "47111": "포항시", "47113": "포항시", "47130": "경주시", "47150": "김천시", "47170": "안동시",
    "47190": "구미시", "47210": "영주시", "47230": "영천시", "47250": "상주시", "47280": "문경시",
    "47290": "경산시", "47720": "군위군", "47730": "의성군", "47750": "청송군", "47760": "영양군",
    "47770": "영덕군", "47820": "청도군", "47830": "고령군", "47840": "성주군", "47850": "칠곡군",
    "47900": "예천군", "47920": "봉화군", "47930": "울진군", "47940": "울릉군", "47920": "봉화군",
    "43720": "군위군",  # 2023.7 대구 편입 전 코드 혼용 대비
}


def clean(value) -> str | None:
    if value is None:
        return None
    v = str(value).strip()
    if not v or v.lower() in ("nan", "none", "null"):
        return None
    return v


def sgg_key(value) -> str | None:
    v = clean(value)
    if not v:
        return None
    if re.fullmatch(r"\d{5,10}", v):
        return SGG_CODE.get(v[:5])
    m = SGG_RE.search(v)
    if m:
        return m.group(1)
    m = STEM_RE.search(v)
    if m:
        return SGG_STEM[m.group(1)]
    return None


def emd_key(value, default_sgg: str | None = None) -> str | None:
    v = clean(value)
    if not v:
        return None
    if re.fullmatch(r"\d{8,10}", v):
        sgg = SGG_CODE.get(v[:5])
        return f"{sgg}|{v[:8]}" if sgg else None
    sgg = sgg_key(v)
    if not sgg:
        # '장량동', '오천읍' 처럼 시군 없이 읍면동만 있는 값: 데이터셋 기본 시군을 붙인다
        m = re.fullmatch(r"\s*([가-힣]{1,7}(?:읍|면|동))\s*", v)
        return f"{default_sgg}|{m.group(1)}" if (m and default_sgg) else None
    # 시군구 이름 뒤쪽에서 읍면동 토큰 찾기
    tail = v[v.find(sgg[:-1]) + len(sgg[:-1]):] if sgg[:-1] in v else v
    tail = re.sub(r"^(시|군)\s*(남구|북구)?\s*", "", tail)
    m = re.search(r"([가-힣]{1,7}(?:읍|면|동))(?=\s|$|[,(\d])", tail)
    if not m:
        return None
    return f"{sgg}|{m.group(1)}"


KEYFN = {"sgg": sgg_key, "emd": emd_key}


def default_sgg_of(ds: dict) -> str | None:
    """제공기관/제목이 단일 시군이면 그 시군 (예: '경상북도 포항시' -> '포항시')"""
    for text in (ds.get("provider", ""), ds.get("title_ko", "")):
        m = SGG_RE.search(text or "")
        if m:
            return m.group(1)
    return None


def column_keys(con, table: str, column: str, limit: int = 20000, default_sgg: str | None = None) -> dict[str, set[str]]:
    try:
        rows = con.execute(f'SELECT DISTINCT "{column}" FROM "{table}" LIMIT {limit}').fetchall()
    except Exception:                                       # noqa: BLE001
        return {"sgg": set(), "emd": set()}
    out = {"sgg": set(), "emd": set()}
    for (val,) in rows:
        k = sgg_key(val)
        if k:
            out["sgg"].add(k)
        k = emd_key(val, default_sgg)
        if k:
            out["emd"].add(k)
    return out


def main() -> None:
    catalog = json.loads((DATA / "catalog.json").read_text(encoding="utf-8"))
    con = duckdb.connect(str(DB), read_only=True)
    nodes, edges = [], []
    key_index: dict[str, list[tuple[str, str, set[str]]]] = {"sgg": [], "emd": []}
    title = {ds["dataset_id"]: ds["title_ko"] for ds in catalog}
    cat = {ds["dataset_id"]: ds["category"] for ds in catalog}
    parent = {ds["dataset_id"]: ds.get("parent_dataset_id", ds["dataset_id"]) for ds in catalog}

    for ds in catalog:
        did = ds["dataset_id"]
        nodes.append({"id": f"ds:{did}", "type": "dataset", "label": ds["title_ko"],
                      "category": ds["category"], "provider": ds["provider"], "rows": ds["rows"]})
        if ds["category"]:
            edges.append({"s": f"ds:{did}", "p": "topic_of", "o": f"topic:{ds['category']}"})
        for kw in ds["keywords"][:10]:
            edges.append({"s": f"ds:{did}", "p": "tagged", "o": f"kw:{kw}"})
        for c in ds["columns"]:
            cid = f"col:{did}.{c['name']}"
            nodes.append({"id": cid, "type": "column", "label": c["name"],
                          "role": c["role"], "desc": c["desc_ko"]})
            edges.append({"s": f"ds:{did}", "p": "has_column", "o": cid})
        # 지역 후보 컬럼: role 이 region/sido 이거나 텍스트인데 값에 시군 이름이 있는 것
        dflt = default_sgg_of(ds)
        ds["default_sgg"] = dflt
        cands = list(ds["region_columns"])
        for c in ds["columns"]:
            if c["name"] not in cands and c["role"] in ("text", "code") and \
                    any(sgg_key(s) or emd_key(s, dflt) for s in c.get("samples", [])):
                cands.append(c["name"])
        best = {"sgg": None, "emd": None}
        for col in cands:
            ks = column_keys(con, ds["table"], col, default_sgg=dflt)
            for lvl in ("sgg", "emd"):
                if len(ks[lvl]) >= MIN_KEYS[lvl] and (best[lvl] is None or len(ks[lvl]) > len(best[lvl][2])):
                    best[lvl] = (did, col, ks[lvl])
        for lvl in ("sgg", "emd"):
            if best[lvl]:
                key_index[lvl].append(best[lvl])
        ds["region_keys"] = {lvl: (best[lvl][1] if best[lvl] else None) for lvl in ("sgg", "emd")}

    print(f"지역 키 보유: sgg {len(key_index['sgg'])}건 / emd {len(key_index['emd'])}건")

    pairs = []
    for lvl, entries in key_index.items():
        for (a_id, a_col, a_keys), (b_id, b_col, b_keys) in combinations(entries, 2):
            if parent[a_id] == parent[b_id]:      # 같은 서비스의 오퍼레이션끼리는 제외
                continue
            inter = a_keys & b_keys
            if not inter:
                continue
            rate = len(inter) / min(len(a_keys), len(b_keys))
            if rate < MIN_MATCH:
                continue
            pairs.append({
                "level": lvl,
                "a": a_id, "a_title": title[a_id], "a_cat": cat[a_id], "a_col": a_col, "a_keys": len(a_keys),
                "b": b_id, "b_title": title[b_id], "b_cat": cat[b_id], "b_col": b_col, "b_keys": len(b_keys),
                "matched": len(inter), "match_rate": round(rate, 3),
                "dropped_a": len(a_keys - b_keys), "dropped_b": len(b_keys - a_keys),
                "sample_matched": "|".join(sorted(inter)[:5]),
                "sample_unmatched": "|".join(sorted(a_keys ^ b_keys)[:5]),
            })
    pairs.sort(key=lambda p: (-p["match_rate"], -p["matched"]))
    for p in pairs:
        edges.append({"s": f"ds:{p['a']}", "p": "joinable_by", "o": f"ds:{p['b']}",
                      "on": p["level"], "a_col": p["a_col"], "b_col": p["b_col"],
                      "matched": p["matched"], "match_rate": p["match_rate"]})
    con.close()

    (DATA / "kg.json").write_text(json.dumps({"nodes": nodes, "edges": edges},
                                             ensure_ascii=False, indent=2), encoding="utf-8")
    # region_keys 를 catalog.json 에도 반영
    (DATA / "catalog.json").write_text(json.dumps(catalog, ensure_ascii=False, indent=2), encoding="utf-8")
    fields = list(pairs[0].keys()) if pairs else ["level", "a", "b"]
    with (DATA / "joinable_pairs.csv").open("w", newline="", encoding="utf-8-sig") as fh:
        w = csv.DictWriter(fh, fieldnames=fields)
        w.writeheader()
        w.writerows(pairs)

    print("\n=== 발표용 실측 수치 ===")
    print(f"데이터셋 {len(catalog)}건, 컬럼 {sum(len(c['columns']) for c in catalog):,}개")
    for lvl in ("sgg", "emd"):
        ps = [p for p in pairs if p["level"] == lvl]
        print(f"[{lvl}] 조인 가능 조합(match_rate>={MIN_MATCH}): {len(ps):,}쌍, "
              f"완전 매칭 {sum(1 for p in ps if p['match_rate'] == 1.0):,}쌍")
    print("\n상위 10쌍:")
    for p in pairs[:10]:
        print(f"  [{p['level']}] {p['match_rate']:.2f} ({p['matched']:>3}개)  "
              f"{p['a_title']}[{p['a_cat'][:6]}].{p['a_col']} <-> {p['b_title']}[{p['b_cat'][:6]}].{p['b_col']}")


if __name__ == "__main__":
    main()
