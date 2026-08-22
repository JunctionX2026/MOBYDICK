#!/usr/bin/env python3
"""
1_fetch_api.py — api_catalog.json 의 오퍼레이션을 실제로 호출해 실데이터를 내려받는다.

규칙
  - 키: .env 의 DATA_GO_KR_KEY(디코딩) 우선, 인증 오류면 DATA_GO_KR_KEY_ENCODED 로 재시도
  - 응답 포맷: type=json → _type=json → dataType=JSON → returnType=JSON → (XML) 순으로 시도
  - 페이지네이션: numOfRows 를 크게 주고 totalCount 까지 돈다. MAX_ROWS 에서 자른다(기록 남김)
  - 목록형 오퍼레이션만: 필수 파라미터가 serviceKey/pageNo/numOfRows/포맷 뿐이거나 샘플값이 있는 것
  - 출력 키: data/raw_files/{dataset_id}.csv  (오퍼레이션이 2개 이상이면 {dataset_id}_{opid}.csv)
    → 1_load_duck.py 가 그대로 t_{dataset_id} 로 적재한다

출력:
  data/raw_files/*.csv
  data/fetch_report.json   데이터셋별 성공/실패/행수/사용한 포맷/오류
"""
from __future__ import annotations
import csv
import json
import os
import re
import sys
import time
import xml.etree.ElementTree as ET
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

import requests

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
RAW = DATA / "raw_files"
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0 Safari/537.36"
WORKERS = 4
DELAY = 0.15
PAGE = 1000
MAX_ROWS = 20000
MAX_PAGES = 60
SKIP_PARAMS = {"servicekey", "pageno", "numofrows", "type", "_type", "datatype",
               "returntype", "resulttype", "format", "pagesize", "page", "perpage"}
FORMAT_TRIES = [{"type": "json"}, {"_type": "json"}, {"dataType": "JSON"},
                {"returnType": "JSON"}, {"resultType": "json"}, {}]


def load_env() -> tuple[str, str]:
    env = {}
    f = ROOT / ".env"
    if f.exists():
        for line in f.read_text(encoding="utf-8").splitlines():
            if "=" in line and not line.strip().startswith("#"):
                k, v = line.split("=", 1)
                env[k.strip()] = v.strip().strip('"').strip("'")
    dec = env.get("DATA_GO_KR_KEY") or os.environ.get("DATA_GO_KR_KEY", "")
    enc = env.get("DATA_GO_KR_KEY_ENCODED") or os.environ.get("DATA_GO_KR_KEY_ENCODED", "")
    if not dec and not enc:
        raise SystemExit(".env 에 DATA_GO_KR_KEY 가 없습니다")
    return dec, enc


# ---------- 응답 파싱 ----------
def find_records(obj, depth=0) -> list[dict]:
    """JSON 안에서 '레코드 리스트'(dict 의 list) 중 가장 긴 것을 찾는다."""
    best: list = []
    if isinstance(obj, list):
        if obj and all(isinstance(x, dict) for x in obj):
            best = obj
        for x in obj:
            c = find_records(x, depth + 1)
            if len(c) > len(best):
                best = c
    elif isinstance(obj, dict):
        for k, v in obj.items():
            if k in ("header", "cmmMsgHeader"):
                continue
            if isinstance(v, dict) and depth > 6:
                continue
            c = find_records(v, depth + 1)
            if len(c) > len(best):
                best = c
        # items.item 이 단일 dict 인 경우 (결과 1건)
        if not best and "item" in obj and isinstance(obj["item"], dict):
            best = [obj["item"]]
    return best


def find_total(obj) -> int | None:
    if isinstance(obj, dict):
        for k, v in obj.items():
            if k.lower() in ("totalcount", "total_count", "totalcnt", "total"):
                try:
                    return int(str(v).replace(",", ""))
                except ValueError:
                    pass
            r = find_total(v)
            if r is not None:
                return r
    elif isinstance(obj, list):
        for x in obj:
            r = find_total(x)
            if r is not None:
                return r
    return None


def json_error(obj) -> str | None:
    """공공데이터포털 표준 오류 감지 → 메시지, 정상이면 None"""
    if not isinstance(obj, dict):
        return None
    h = obj.get("OpenAPI_ServiceResponse", {}).get("cmmMsgHeader") if "OpenAPI_ServiceResponse" in obj else None
    if h:
        return f"{h.get('returnReasonCode')}:{h.get('returnAuthMsg') or h.get('errMsg')}"
    resp = obj.get("response", obj)
    hdr = resp.get("header") if isinstance(resp, dict) else None
    if isinstance(hdr, dict):
        code = str(hdr.get("resultCode", "")).strip()
        if code and code not in ("0", "00", "000", "200", "OK", "INFO-000", "INFO-00", "INFO-0"):
            if not find_records(resp):
                return f"{code}:{hdr.get('resultMsg', '')}"
    return None


def xml_to_obj(text: str):
    root = ET.fromstring(text.encode("utf-8") if isinstance(text, str) else text)

    def conv(el):
        kids = list(el)
        if not kids:
            return (el.text or "").strip()
        d: dict = {}
        for k in kids:
            tag = k.tag.split("}")[-1]
            v = conv(k)
            if tag in d:
                if not isinstance(d[tag], list):
                    d[tag] = [d[tag]]
                d[tag].append(v)
            else:
                d[tag] = v
        return d
    return {root.tag.split("}")[-1]: conv(root)}


def parse_body(text: str, ctype: str):
    t = text.lstrip()
    if t.startswith("{") or t.startswith("["):
        return json.loads(t), "json"
    if t.startswith("<"):
        return xml_to_obj(t), "xml"
    raise ValueError(f"알 수 없는 응답: {ctype} {t[:80]!r}")


# ---------- 호출 ----------
class Fetcher:
    def __init__(self, dec: str, enc: str):
        self.dec, self.enc = dec, enc
        self.s = requests.Session()
        self.s.headers["User-Agent"] = UA

    def call(self, url: str, params: dict, key_mode: str) -> tuple[object, str]:
        p = dict(params)
        if key_mode == "dec":
            p["serviceKey"] = self.dec or self.enc
            r = self.s.get(url, params=p, timeout=60)
        else:
            from urllib.parse import urlencode
            q = urlencode(p)
            r = self.s.get(f"{url}?serviceKey={self.enc or self.dec}&{q}", timeout=60)
        time.sleep(DELAY)
        ctype = r.headers.get("content-type", "")
        return parse_body(r.text, ctype)

    def probe(self, url: str, base_params: dict) -> tuple[dict, str, str] | None:
        """포맷·키 조합을 찾아 (fmt_params, key_mode, kind) 반환. 실패 시 None."""
        last_err = ""
        for key_mode in ("dec", "enc"):
            for fmt in FORMAT_TRIES:
                try:
                    obj, kind = self.call(url, {**base_params, **fmt, "pageNo": 1, "numOfRows": 5}, key_mode)
                except Exception as e:                      # noqa: BLE001
                    last_err = str(e)[:120]
                    continue
                err = json_error(obj)
                if err:
                    last_err = err
                    code = err.split(":")[0]
                    if code in ("30", "31", "32", "33", "20", "21", "22"):   # 키/트래픽 문제 → 키 모드 변경
                        break
                    continue
                if find_records(obj) or find_total(obj) == 0:
                    return {**fmt}, key_mode, kind
                last_err = f"no-records({kind})"
        self.last_err = last_err
        return None

    def fetch_all(self, url: str, base_params: dict) -> tuple[list[dict], dict]:
        info: dict = {"url": url, "params": base_params}
        pr = self.probe(url, base_params)
        if not pr:
            info["error"] = getattr(self, "last_err", "probe failed")
            return [], info
        fmt, key_mode, kind = pr
        info.update(format=fmt, key_mode=key_mode, kind=kind)
        rows: list[dict] = []
        total = None
        for page in range(1, MAX_PAGES + 1):
            try:
                obj, _ = self.call(url, {**base_params, **fmt, "pageNo": page, "numOfRows": PAGE}, key_mode)
            except Exception as e:                          # noqa: BLE001
                info["error"] = f"page{page}: {str(e)[:100]}"
                break
            if json_error(obj):
                info["error"] = f"page{page}: {json_error(obj)}"
                break
            recs = find_records(obj)
            if total is None:
                total = find_total(obj)
                info["total_count"] = total
            if not recs:
                break
            rows.extend(recs)
            if len(recs) < PAGE and (total is None or len(rows) >= total):
                break
            if total is not None and len(rows) >= total:
                break
            if len(rows) >= MAX_ROWS:
                info["truncated"] = True
                break
        # 중복 페이지(페이지네이션 미지원) 방지
        if len(rows) >= 2 * PAGE and rows[:PAGE] == rows[PAGE:2 * PAGE]:
            rows = rows[:PAGE]
            info["no_pagination"] = True
        info["rows"] = len(rows)
        return rows, info


def flatten(rec: dict, prefix="") -> dict:
    out = {}
    for k, v in rec.items():
        kk = f"{prefix}{k}"
        if isinstance(v, dict):
            out.update(flatten(v, kk + "_"))
        elif isinstance(v, list):
            out[kk] = json.dumps(v, ensure_ascii=False)
        else:
            out[kk] = "" if v is None else str(v)
    return out


def write_csv(path: Path, rows: list[dict]) -> int:
    flat = [flatten(r) for r in rows]
    cols: list[str] = []
    for r in flat:
        for k in r:
            if k not in cols:
                cols.append(k)
    with path.open("w", newline="", encoding="utf-8-sig") as fh:
        w = csv.DictWriter(fh, fieldnames=cols)
        w.writeheader()
        for r in flat:
            w.writerow(r)
    return len(cols)


def list_operations(ds: dict) -> list[dict]:
    """목록형(파라미터 없이 돌릴 수 있는) 오퍼레이션 고르기."""
    ops = []
    for op in ds.get("operations", []):
        path = op.get("path") or ""
        if not path or path == "/":
            continue
        base = {}
        ok = True
        for p in op.get("params", []):
            nm = (p.get("name") or "").strip()
            if nm.lower() in SKIP_PARAMS or not nm:
                continue
            if p.get("required"):
                smp = (p.get("sample") or "").strip()
                if smp and smp not in ("-", "없음"):
                    base[nm] = smp
                else:
                    ok = False
                    break
        if ok:
            ops.append({"op": op, "base": base})
    return ops


def main() -> None:
    dec, enc = load_env()
    RAW.mkdir(parents=True, exist_ok=True)
    catalog = json.loads((DATA / "api_catalog.json").read_text(encoding="utf-8"))
    jobs = []
    for ds in catalog:
        if ds.get("match") == "title":
            # 제목만 맞은 건 기관이 같을 때만 (타 지역 동명 API 오매칭 방지)
            org_tail = (ds.get("org") or "").split()[-1]
            if org_tail not in (ds.get("page_title") or ""):
                continue
        elif ds.get("match") != "host":
            continue
        host = ds.get("host") or ""
        if not host:
            continue
        ops = list_operations(ds)
        multi = len(ops) > 1
        for o in ops:
            op = o["op"]
            url = op.get("full_url") or ("https://" + host.rstrip("/") + op["path"])
            opid = re.sub(r"[^A-Za-z0-9]", "", op.get("operation_id") or op["path"])[:40]
            fid = f"{ds['dataset_id']}_{opid}" if multi else ds["dataset_id"]
            jobs.append({"dataset_id": ds["dataset_id"], "file_id": fid, "title": ds.get("page_title") or ds["name"],
                         "op": op.get("summary", ""), "url": url, "base": o["base"]})
    only = set(sys.argv[1:])
    if only:
        jobs = [j for j in jobs if j["dataset_id"] in only or j["file_id"] in only]
    print(f"호출 대상 오퍼레이션: {len(jobs)}개 (데이터셋 {len({j['dataset_id'] for j in jobs})}건)")

    report = []

    def work(job):
        dest = RAW / f"{job['file_id']}.csv"
        if dest.exists() and dest.stat().st_size > 0:
            return {**job, "status": "skip"}
        f = Fetcher(dec, enc)
        rows, info = f.fetch_all(job["url"], job["base"])
        if rows:
            ncol = write_csv(dest, rows)
            return {**job, "status": "ok", "rows": len(rows), "cols": ncol, **info}
        return {**job, "status": "fail", **info}

    with ThreadPoolExecutor(max_workers=WORKERS) as ex:
        futs = [ex.submit(work, j) for j in jobs]
        for i, fut in enumerate(as_completed(futs), 1):
            r = fut.result()
            report.append(r)
            if r["status"] == "fail":
                print(f"  FAIL {r['file_id']} {r['title'][:30]} :: {r.get('error','')[:90]}", flush=True)
            if i % 20 == 0:
                ok = sum(1 for x in report if x["status"] == "ok")
                print(f"  {i}/{len(jobs)} ok={ok}", flush=True)

    report.sort(key=lambda r: r["file_id"])
    (DATA / "fetch_report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    ok = [r for r in report if r["status"] == "ok"]
    skip = [r for r in report if r["status"] == "skip"]
    fail = [r for r in report if r["status"] == "fail"]
    print(f"\n완료: ok={len(ok)} skip={len(skip)} fail={len(fail)}  "
          f"행 합계 {sum(r.get('rows', 0) for r in ok):,}")
    print("실패 사유 분포:")
    from collections import Counter
    print(Counter((r.get("error") or "")[:40] for r in fail).most_common(15))


if __name__ == "__main__":
    main()
