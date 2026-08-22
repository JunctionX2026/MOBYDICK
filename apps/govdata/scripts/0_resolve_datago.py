#!/usr/bin/env python3
"""
0_resolve_datago.py — data/endpoints.csv 의 서비스 URL을 data.go.kr 상세 페이지와 매칭해
오퍼레이션 경로·요청 파라미터·응답 필드(한글 설명)를 뽑는다.

data.go.kr 상세 페이지(/data/{id}/openapi.do)에는 swaggerJson 이 인라인으로 박혀 있어
  host, paths(오퍼레이션), 요청 파라미터(필수/샘플값), 응답 필드 + 한글 설명
을 그대로 얻을 수 있다. 이것이 컬럼 위키의 1차 원천이다.

출력:
  data/api_catalog.json   [{dataset_id, title, org, endpoint, page_id, operations:[...]}]
  data/datago_pages/{page_id}.html  (캐시)
"""
from __future__ import annotations
import csv
import json
import re
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from urllib.parse import urlparse

import requests
from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
PAGES = DATA / "datago_pages"
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0 Safari/537.36"
SEARCH = "https://www.data.go.kr/tcs/dss/selectDataSetList.do"
DELAY = 0.2
WORKERS = 4
SWAGGER_RE = re.compile(r"const swaggerJson = `(.*?)`;", re.S)


def norm(s: str) -> str:
    return re.sub(r"[\s_\-·,()\[\]]", "", s or "").lower()


def endpoint_path(url: str) -> str:
    """https://apis.data.go.kr/6470000/PriceInfoPerson -> apis.data.go.kr/6470000/priceinfoperson"""
    p = urlparse(url.strip())
    return (p.netloc + p.path).rstrip("/").lower()


def get(s: requests.Session, url: str, **kw) -> str:
    for attempt in range(3):
        try:
            r = s.get(url, timeout=40, **kw)
            r.raise_for_status()
            return r.text
        except Exception:                                   # noqa: BLE001
            time.sleep(1 + attempt)
    return ""


def page_html(s: requests.Session, pid: str) -> str:
    f = PAGES / f"{pid}.html"
    if f.exists() and f.stat().st_size > 1000:
        return f.read_text(encoding="utf-8")
    html = get(s, f"https://www.data.go.kr/data/{pid}/openapi.do")
    time.sleep(DELAY)
    if html:
        f.write_text(html, encoding="utf-8")
    return html


def parse_page(html: str) -> dict:
    """swaggerJson → {host, title, description, operations:[{path, summary, params, fields}]}"""
    out: dict = {"host": "", "operations": [], "title": "", "description": "",
                 "update_cycle": "", "keywords": [], "category": ""}
    soup = BeautifulSoup(html, "html.parser")
    for li in soup.select("li"):
        k = li.select_one("strong.key")
        v = li.select_one(".value")
        if not k or not v:
            continue
        key = k.get_text(strip=True)
        val = " ".join(v.get_text().split())
        if key == "갱신주기":
            out["update_cycle"] = val
        elif key == "키워드":
            out["keywords"] = [x.strip() for x in val.split(",") if x.strip()]
        elif key == "분류체계":
            out["category"] = val
        elif key == "요청주소" and not out.get("req_url"):
            out["req_url"] = val
    m = SWAGGER_RE.search(html)
    if not m:
        return out
    raw = m.group(1).replace("\\`", "`")
    try:
        sw = json.loads(raw)
    except json.JSONDecodeError:
        try:
            sw = json.loads(raw.encode().decode("unicode_escape"))
        except Exception:                                   # noqa: BLE001
            return out
    out["host"] = (sw.get("host", "") + sw.get("basePath", "")).rstrip("/")
    info = sw.get("info", {})
    out["title"] = info.get("title", "")
    out["description"] = (info.get("description", "") or "").replace("\\n", "\n").strip()

    # 응답 필드: swaggerOprtinVOs[].resList 에 한글 설명이 제일 깔끔하게 있다
    vo_by_op = {vo.get("operationId") or vo.get("gwSvcNm"): vo
                for vo in sw.get("swaggerOprtinVOs", [])}

    def flatten_res(lst, acc):
        for p in lst or []:
            sub = p.get("subParam")
            if sub:
                flatten_res(sub, acc)
            else:
                nm = p.get("paramtrNm", "")
                if nm and nm not in ("resultCode", "resultMsg", "numOfRows", "pageNo", "totalCount"):
                    acc.append({"name": nm, "desc": p.get("paramtrDc", ""),
                                "type": p.get("paramtrTy", "")})

    def flatten_schema(props, acc, depth=0):
        for nm, spec in (props or {}).items():
            sub = spec.get("properties") or (spec.get("items") or {}).get("properties")
            if sub and depth < 6:
                flatten_schema(sub, acc, depth + 1)
            elif nm not in ("resultCode", "resultMsg", "numOfRows", "pageNo", "totalCount",
                            "header", "body", "items", "item"):
                acc.append({"name": nm, "desc": spec.get("description", ""),
                            "type": spec.get("type", "")})

    for path, ops in (sw.get("paths") or {}).items():
        g = ops.get("get") or ops.get("post") or {}
        params = []
        for p in ops.get("parameters", []) + g.get("parameters", []):
            params.append({"name": p.get("name"), "desc": p.get("description", ""),
                           "required": bool(p.get("required")), "type": p.get("type", ""),
                           "sample": ""})
        opid = g.get("operationId") or path.strip("/")
        vo = vo_by_op.get(opid)
        fields: list = []
        if vo:
            samples = {r.get("paramtrNm"): r.get("paramtrBassValue", "") for r in vo.get("reqList", [])}
            for p in params:
                p["sample"] = samples.get(p["name"], "")
            flatten_res(vo.get("resList"), fields)
        if not fields:
            schema = ((g.get("responses") or {}).get("200") or {}).get("schema") or {}
            flatten_schema(schema.get("properties"), fields)
        # dedupe
        seen, uniq = set(), []
        for f in fields:
            if f["name"] not in seen:
                seen.add(f["name"]); uniq.append(f)
        out["operations"].append({
            "path": path, "operation_id": opid,
            "summary": g.get("summary", ""), "description": g.get("description", ""),
            "params": params, "fields": uniq,
            "produces": g.get("produces", []),
        })
    return out


def parse_tables(frag: BeautifulSoup) -> tuple[list, list, str]:
    """레거시 페이지 조각 → (params, fields, service_url)"""
    url, base = "", ""
    for li in frag.select("li"):
        k = li.select_one("strong.key"); v = li.select_one(".value")
        if not (k and v):
            continue
        t = " ".join(v.get_text().split()).rstrip("</a>")
        if not t.startswith("http"):
            continue
        if k.get_text(strip=True) == "요청주소":
            url = t
        elif k.get_text(strip=True) == "서비스 URL":
            base = t
    url = url or base
    tables = []
    for t in frag.select("table"):
        hdr = [" ".join(th.get_text().split()) for th in t.select("tr th")]
        if "항목명(영문)" not in hdr:
            continue
        rows = []
        for tr in t.select("tbody tr"):
            td = [" ".join(x.get_text().split()) for x in tr.select("td")]
            if len(td) >= 6 and td[1]:
                rows.append({"name": td[1], "desc": td[5] or td[0], "ko": td[0],
                             "required": td[3] == "필수", "sample": td[4], "type": ""})
        tables.append(rows)
    params = tables[0] if tables else []
    fields = tables[1] if len(tables) > 1 else []
    return params, [{"name": f["name"], "desc": f["desc"], "type": ""} for f in fields], url


def legacy_operations(s: requests.Session, html: str, pid: str) -> list[dict]:
    """swaggerJson 이 비어 있는 레거시 페이지: 오퍼레이션 select 를 돌며 AJAX 조각을 받는다."""
    soup = BeautifulSoup(html, "html.parser")
    pk = soup.select_one("#publicDataDetailPk")
    pk2 = soup.select_one("#publicDataPk")
    opts = soup.select("#open_api_detail_select option")
    ops = []
    for o in opts:
        seq = o.get("value", "").strip()
        label = o.get_text(strip=True)
        f = PAGES / f"{pid}_{seq}.html"
        if f.exists() and f.stat().st_size > 500:
            frag_html = f.read_text(encoding="utf-8")
        else:
            frag_html = ""
            for attempt in range(3):
                try:
                    r = s.post("https://www.data.go.kr/tcs/dss/selectApiDetailFunction.do",
                               data={"oprtinSeqNo": seq,
                                     "publicDataDetailPk": pk.get("value", "") if pk else "",
                                     "publicDataPk": pk2.get("value", "") if pk2 else pid},
                               timeout=40)
                    r.raise_for_status(); frag_html = r.text; break
                except Exception:                           # noqa: BLE001
                    time.sleep(1 + attempt)
            time.sleep(DELAY)
            if frag_html:
                f.write_text(frag_html, encoding="utf-8")
        if not frag_html:
            continue
        params, fields, url = parse_tables(BeautifulSoup(frag_html, "html.parser"))
        ops.append({"path": "/" + url.rstrip("/").rsplit("/", 1)[-1] if url else "",
                    "full_url": url, "operation_id": url.rsplit("/", 1)[-1] if url else label,
                    "summary": label, "description": "", "params": params,
                    "fields": fields, "produces": []})
    return ops


def search(s: requests.Session, keyword: str) -> list[tuple[str, str]]:
    html = get(s, SEARCH, params={"dType": "API", "keyword": keyword})
    time.sleep(DELAY)
    soup = BeautifulSoup(html, "html.parser")
    res = []
    for a in soup.select("div.apply-result-link a[href*='/openapi.do']"):
        m = re.search(r"/data/(\d+)/openapi\.do", a["href"])
        if m:
            res.append((m.group(1), " ".join(a.get_text().split())))
    return res


def resolve_one(row: dict) -> dict:
    s = requests.Session()
    s.headers["User-Agent"] = UA
    org, name, ep = row["기관"], row["데이터명"], row["End Point"].strip()
    rec = {"org": org, "name": name, "endpoint": ep, "page_id": None,
           "match": "none", "candidates": []}
    if not ep.startswith("http"):
        rec["match"] = "no_endpoint"
        return rec
    target = endpoint_path(ep)
    svc = target.rsplit("/", 1)[-1]
    # 후보: 데이터명 검색 + 서비스명 검색
    cands: list[tuple[str, str]] = []
    for kw in (name, name.split("_")[-1], svc):
        for c in search(s, kw):
            if c not in cands:
                cands.append(c)
        if len(cands) >= 6:
            break
    rec["candidates"] = cands[:10]
    # 제목 유사도로 정렬 후 페이지 열어 host 검증
    nn = norm(name)
    cands.sort(key=lambda c: (nn not in norm(c[1]), norm(org.split()[-1]) not in norm(c[1])))
    for pid, title in cands[:6]:
        html = page_html(s, pid)
        if not html:
            continue
        parsed = parse_page(html)
        if not parsed["operations"]:
            parsed["operations"] = legacy_operations(s, html, pid)
            if parsed["operations"] and not parsed.get("req_url"):
                parsed["req_url"] = next((o["full_url"] for o in parsed["operations"] if o.get("full_url")), "")
            if not parsed["host"] and parsed.get("req_url"):
                parsed["host"] = endpoint_path(parsed["req_url"]).rsplit("/", 1)[0]
        host = parsed.get("host", "").lower()
        req = endpoint_path(parsed.get("req_url", "")) if parsed.get("req_url") else ""
        if host == target or req.startswith(target) or (host and target.startswith(host) and svc in host):
            rec.update(page_id=pid, page_title=title, match="host", **{k: v for k, v in parsed.items() if k != "req_url"})
            return rec
        if nn and nn in norm(title) and not rec.get("page_id"):
            rec.update(page_id=pid, page_title=title, match="title", **{k: v for k, v in parsed.items() if k != "req_url"})
    return rec


def main() -> None:
    PAGES.mkdir(parents=True, exist_ok=True)
    rows = list(csv.DictReader((DATA / "endpoints.csv").open(encoding="utf-8-sig")))
    print(f"endpoints: {len(rows)}")
    results: list[dict] = [None] * len(rows)  # type: ignore

    def work(i: int):
        try:
            results[i] = resolve_one(rows[i])
        except Exception as e:                              # noqa: BLE001
            results[i] = {**rows[i], "match": "error", "error": str(e)[:200]}
        if (i + 1) % 20 == 0:
            done = sum(1 for r in results if r)
            print(f"  {done}/{len(rows)}", flush=True)

    with ThreadPoolExecutor(max_workers=WORKERS) as ex:
        list(ex.map(work, range(len(rows))))

    for i, r in enumerate(results, 1):
        r["dataset_id"] = r.get("page_id") or f"x{i:03d}"
    (DATA / "api_catalog.json").write_text(
        json.dumps(results, ensure_ascii=False, indent=2), encoding="utf-8")
    by = {}
    for r in results:
        by[r["match"]] = by.get(r["match"], 0) + 1
    nops = sum(len(r.get("operations", [])) for r in results)
    print(f"\napi_catalog.json: {len(results)}건, 매칭 {by}, 오퍼레이션 {nops}개")
    for r in results:
        if r["match"] not in ("host",):
            print(f"  [{r['match']}] {r['org']} / {r['name']} -> {r.get('page_title','')}")


if __name__ == "__main__":
    main()
