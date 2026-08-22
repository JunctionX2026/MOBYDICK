"""
core.py — GovData Studio 실행 계층
  Catalog   : catalog.json / kg.json 로드, 하이브리드 검색(BM25 + e5 임베딩)
  Graph     : joinable_by 엣지 탐색 → 서로 조인 가능한 데이터셋 집합 추천
  Compiler  : OperationSpec → DuckDB SQL → 실행 + dropped_detail (어떤 키가 왜 빠졌는지)
원칙: 행은 임베딩하지 않는다. LLM은 계획만 세우고 계산은 DuckDB가 한다.
"""
from __future__ import annotations

import json
import math
import os
import re
import subprocess
import sys
import tempfile
import threading
from collections import defaultdict
from pathlib import Path
from typing import Any

import duckdb
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
IDX = DATA / "index"
DB = DATA / "gbdata.duckdb"
sys.path.insert(0, str(ROOT / "scripts"))
import importlib
_kg = importlib.import_module("3_build_kg")
sgg_key, emd_key = _kg.sgg_key, _kg.emd_key

LEVEL_LABEL = {"sgg": "시군구 (city/county)", "emd": "읍면동 (town/village)", "raw": "exact value"}


def _tok(s: str) -> list[str]:
    s = s.lower()
    toks = re.findall(r"[a-z0-9]+|[가-힣]+", s)
    out = []
    for t in toks:
        out.append(t)
        if re.match(r"[가-힣]{3,}", t):          # 한글은 2-gram 도 추가 (형태소 없이 부분매칭)
            out.extend(t[i:i + 2] for i in range(len(t) - 1))
    return out

# ---------- 영문 질의 확장 (소형 임베딩 모델의 교차언어 약점 보완; LLM 없이 동작)
EN_KO = {
    # 지역
    "pohang": "포항시", "gyeongju": "경주시", "gimcheon": "김천시", "andong": "안동시", "gumi": "구미시",
    "yeongju": "영주시", "yeongcheon": "영천시", "sangju": "상주시", "mungyeong": "문경시", "gyeongsan": "경산시",
    "uiseong": "의성군", "cheongsong": "청송군", "yeongyang": "영양군", "yeongdeok": "영덕군", "cheongdo": "청도군",
    "goryeong": "고령군", "seongju": "성주군", "chilgok": "칠곡군", "yecheon": "예천군", "bonghwa": "봉화군",
    "uljin": "울진군", "ulleung": "울릉군", "gyeongbuk": "경상북도", "gyeongsangbuk": "경상북도",
    # 단위
    "city": "시군 시군구", "county": "군 시군구", "town": "읍면동", "village": "마을 읍면동", "district": "구 읍면동",
    "region": "지역", "area": "지역", "monthly": "월별", "yearly": "연도별", "daily": "일별", "hourly": "시간별",
    # 도메인
    "elderly": "노인", "senior": "노인 경로당", "seniors": "노인", "welfare": "복지", "facility": "시설", "facilities": "시설",
    "hospital": "병원 의료기관 병의원", "hospitals": "병원 의료기관 병의원", "clinic": "의원", "pharmacy": "약국", "pharmacies": "약국",
    "medical": "의료", "health": "보건", "child": "어린이 아동", "children": "어린이 아동", "kids": "어린이",
    "protection": "보호", "zone": "구역", "zones": "구역", "school": "학교", "cctv": "CCTV 방범", "camera": "카메라 CCTV",
    "toilet": "화장실", "toilets": "공중화장실", "restroom": "화장실", "public": "공공 공영",
    "social": "사회적", "enterprise": "기업", "enterprises": "기업", "company": "기업", "companies": "기업",
    "cooperative": "협동조합", "restaurant": "음식점", "restaurants": "일반음식점", "food": "음식 먹거리", "cafe": "카페",
    "price": "가격 물가 요금", "prices": "물가 가격", "cost": "요금 비용", "rice": "쌀", "pork": "돼지고기", "beef": "쇠고기",
    "cabbage": "배추", "egg": "달걀", "eggs": "달걀", "noodle": "냉면 칼국수", "naengmyeon": "냉면",
    "population": "인구", "resident": "주민 거주", "residents": "주민등록 인구", "living": "생활 인구", "floating": "유동 인구",
    "visitor": "방문 인구", "visitors": "방문", "foreigner": "외국인", "foreigners": "외국인", "age": "연령", "gender": "성별",
    "household": "세대", "households": "세대", "move-in": "전입", "move-out": "전출", "migration": "전입 전출",
    "shelter": "대피 장소 대피소", "shelters": "대피 장소", "evacuation": "대피", "disaster": "재난", "earthquake": "지진",
    "capacity": "수용 인원", "flood": "홍수 침수", "rainfall": "강우량", "weather": "기상", "air": "대기", "pollution": "오염",
    "solar": "태양광", "power": "발전", "energy": "에너지", "permit": "허가", "permits": "허가", "license": "허가 신고",
    "building": "건물", "buildings": "건물 건축물", "land": "토지", "house": "주택", "housing": "주택 공동주택",
    "property": "재산", "tax": "세 과세", "budget": "예산", "contract": "계약", "payment": "대금 지급",
    "parking": "주차장", "bus": "버스", "stop": "정류장", "stops": "정류장", "route": "노선", "traffic": "교통 교통량",
    "road": "도로", "speed": "속도", "vehicle": "자동차 차량", "vehicles": "자동차", "ev": "전기차", "car": "자동차",
    "library": "도서관", "libraries": "도서관", "museum": "박물관", "culture": "문화", "cultural": "문화재",
    "heritage": "문화재", "tour": "관광", "tourism": "관광", "tourist": "관광지", "attraction": "관광지", "attractions": "관광지",
    "festival": "축제", "festivals": "축제", "event": "행사", "events": "행사", "exhibition": "전시", "camping": "캠핑장",
    "stay": "숙박 민박", "stays": "숙박 민박", "farm": "농어촌 농가", "farmstay": "농어촌민박", "guesthouse": "게스트하우스",
    "hotel": "호텔 숙박", "accommodation": "숙박", "sports": "체육", "sport": "체육", "gym": "체육시설", "park": "공원",
    "wifi": "와이파이", "market": "시장 전통시장", "shop": "업소", "shops": "업소", "store": "업소", "stores": "업소",
    "good-price": "착한가격", "cheap": "착한가격", "discount": "할인", "job": "취업 일자리", "jobs": "취업", "employment": "고용",
    "factory": "공장", "factories": "공장", "industry": "산업", "manufacturing": "제조", "waste": "폐기물", "sewage": "하수",
    "water": "상수도 수질", "reservoir": "저수지", "livestock": "가축 축산", "animal": "동물", "animals": "동물", "pet": "반려동물",
    "veterinary": "동물병원", "disabled": "장애인", "disability": "장애인", "youth": "청소년", "daycare": "보육 어린이집",
    "nursery": "보육", "care": "요양 돌봄", "nursing": "장기요양", "center": "센터", "centers": "센터",
    "community": "주민 마을", "office": "주민센터 행정", "funeral": "장례식장", "fire": "소방", "police": "경찰",
    "safety": "안전", "crime": "방범", "snow": "제설", "covid": "코로나", "fuel": "연료", "smoking": "금연", "tobacco": "담배",
    "news": "시정뉴스", "walking": "걷기길", "trail": "숲길 걷기길", "night": "야경", "view": "전망",
}
EN_KO_PHRASE = {
    "village compan": "마을기업", "social enterprise": "사회적기업", "child protection zone": "어린이보호구역",
    "child zone": "어린이보호구역", "public toilet": "공중화장실", "senior center": "경로당", "living population": "생활인구",
    "floating population": "유동인구", "resident population": "주민등록 인구", "public building": "건물재산 공공건물",
    "good-price shop": "착한가격업소", "good price shop": "착한가격업소", "farm stay": "농어촌민박", "food price": "밥상물가",
    "service price": "개인서비스요금", "sports facilit": "체육시설", "shelter capacity": "대피 장소 수용인원",
    "solar permit": "태양광발전사업 허가", "welfare facilit": "복지시설", "nursing home": "장기요양시설",
    "bus stop": "버스 정류장", "parking lot": "주차장", "traditional market": "전통시장", "public wifi": "공공와이파이",
    "animal hospital": "동물병원", "real estate": "부동산중개업", "land price": "개별공시지가", "house price": "개별주택가격",
}
_SPLIT_RE = re.compile(r"\s*(?:,|;|/| vs\.? | versus | and | & | with | against | compared to )\s*", re.I)
_TRAIL_RE = re.compile(r"\s+(by|per|in|for|of)\s+(city|county|town|village|district|region|month|year|area)\b.*$", re.I)
_LEAD_RE = re.compile(r"^\s*(show|compare|list|find|get|what is|what are|how many|which)\s+", re.I)


KO_SYN = {
    "정류장": "정거장 버스", "정거장": "정류장 버스", "병원": "병의원 의료기관", "의료기관": "병원 병의원", "병의원": "병원 의료기관",
    "식당": "음식점", "음식점": "식당 일반음식점", "미세먼지": "대기오염 환경 pm10", "대기": "대기오염", "공기": "대기오염",
    "노인정": "경로당", "경로당": "노인 복지", "어린이집": "보육시설", "유치원": "보육 교육", "관광지": "관광", "숙소": "숙박",
    "인구": "인구 주민등록 생활인구", "유동인구": "유동 인구", "주차": "주차장", "화장실": "공중화장실", "시장": "전통시장",
    "공장": "제조 공장 공업", "폐기물": "폐기물 배출", "태양광": "태양광발전", "축제": "축제 행사", "cctv": "CCTV 방범",
    "폭염": "폭염 더위 기상 노령 인구 무더위쉼터 대피 장소",
    "더위": "폭염 기상 노령 인구 무더위쉼터 대피 장소",
    "취약": "취약 노령 인구 기상 무더위쉼터 대피 장소",
    "갈 곳": "무더위쉼터 대피 장소 경로당",
}
_REGION_RE = re.compile("(" + "|".join(_kg.GB_SGG) + "|" + "|".join(s[:-1] for s in _kg.GB_SGG) + "|"
                        + "|".join(k for k, v in EN_KO.items() if v.endswith(("시", "군"))) + ")", re.I)


def query_region(q: str) -> str | None:
    m = _REGION_RE.search(q)
    if not m:
        return None
    t = m.group(1)
    if t.lower() in EN_KO:
        return EN_KO[t.lower()]
    return _kg.SGG_STEM.get(t, t)


def expand_query(q: str) -> str:
    extra = [ko for en, ko in EN_KO_PHRASE.items() if en in q.lower()]
    extra += [ko for k, ko in KO_SYN.items() if k in q.lower()]
    for t in re.findall(r"[A-Za-z][A-Za-z\-]+", q.lower()):
        if t in EN_KO:
            extra.append(EN_KO[t])
        elif t.endswith("s") and t[:-1] in EN_KO:
            extra.append(EN_KO[t[:-1]])
    return q + (" " + " ".join(extra) if extra else "")


def split_query(q: str) -> list[str]:
    """'A vs B by city' -> ['A', 'B'] (지역 접두는 각 조각에 붙여 준다)"""
    core = _LEAD_RE.sub("", _TRAIL_RE.sub("", q)).strip()
    m = re.match(r"^([A-Za-z가-힣]+)\s*:\s*(.+)$", core)
    prefix = ""
    if m and (m.group(1).lower() in EN_KO or re.search(r"[시군구도]$", m.group(1))):
        prefix, core = m.group(1) + " ", m.group(2)
    parts = [p.strip() for p in _SPLIT_RE.split(core) if p.strip()]
    if len(parts) < 2:
        return []
    # 첫 조각이 지역명으로 시작하면 ('Yeongju solar permits vs public buildings') 모든 조각에 전파
    if not prefix:
        m = re.match(r"^([A-Za-z]+|[가-힣]+[시군])\s+", parts[0])
        if m and (m.group(1).lower() in EN_KO and EN_KO[m.group(1).lower()].endswith(("시", "군", "도"))
                  or re.search(r"[시군]$", m.group(1))):
            prefix = m.group(1) + " "
            parts[0] = parts[0][m.end():]
    return [prefix + p for p in parts]


class Catalog:
    def __init__(self) -> None:
        self.datasets: list[dict] = json.loads((DATA / "catalog.json").read_text(encoding="utf-8"))
        self.by_id = {d["dataset_id"]: d for d in self.datasets}
        kg = json.loads((DATA / "kg.json").read_text(encoding="utf-8"))
        self.join_edges: dict[str, list[dict]] = defaultdict(list)
        for e in kg["edges"]:
            if e["p"] != "joinable_by":
                continue
            a, b = e["s"][3:], e["o"][3:]
            self.join_edges[a].append({"other": b, "level": e["on"], "my_col": e["a_col"],
                                       "other_col": e["b_col"], "matched": e["matched"],
                                       "match_rate": e["match_rate"]})
            self.join_edges[b].append({"other": a, "level": e["on"], "my_col": e["b_col"],
                                       "other_col": e["a_col"], "matched": e["matched"],
                                       "match_rate": e["match_rate"]})
        # ---- 검색 인덱스
        self.ddocs = json.loads((IDX / "dataset_docs.json").read_text(encoding="utf-8"))
        self.cdocs = json.loads((IDX / "column_docs.json").read_text(encoding="utf-8"))
        from rank_bm25 import BM25Okapi
        self.bm25_d = BM25Okapi([_tok(d["text"]) for d in self.ddocs])
        self.bm25_c = BM25Okapi([_tok(d["text"]) for d in self.cdocs])
        self.demb = np.load(IDX / "dataset_emb.npy") if (IDX / "dataset_emb.npy").exists() else None
        self.cemb = np.load(IDX / "column_emb.npy") if (IDX / "column_emb.npy").exists() else None
        self._model = None
        self._lock = threading.Lock()

    # ---------- 임베딩 (lazy)
    def embed(self, q: str) -> np.ndarray | None:
        if self.demb is None:
            return None
        with self._lock:
            if self._model is None:
                from sentence_transformers import SentenceTransformer
                self._model = SentenceTransformer("intfloat/multilingual-e5-small", device="cpu")
        return self._model.encode(["query: " + q], device="cpu", normalize_embeddings=True)[0].astype(np.float32)

    @staticmethod
    def _minmax(x: np.ndarray) -> np.ndarray:
        lo, hi = float(x.min()), float(x.max())
        return (x - lo) / (hi - lo) if hi > lo else np.zeros_like(x)

    def search(self, q: str, k: int = 8, alpha: float = 0.7) -> list[dict]:
        """하이브리드: alpha*embedding + (1-alpha)*bm25 (둘 다 0~1 정규화)"""
        q = expand_query(q)
        bm = np.array(self.bm25_d.get_scores(_tok(q)), dtype=np.float32)
        score = (1 - alpha) * self._minmax(bm)
        qv = self.embed(q)
        if qv is not None:
            score = score + alpha * self._minmax(self.demb @ qv)
        # 컬럼 매칭 보너스: 컬럼 문서가 강하게 맞으면 해당 데이터셋 가산
        cbm = np.array(self.bm25_c.get_scores(_tok(q)), dtype=np.float32)
        if qv is not None:
            cbm = 0.5 * self._minmax(cbm) + 0.5 * self._minmax(self.cemb @ qv)
        else:
            cbm = self._minmax(cbm)
        best_col: dict[str, tuple[float, str]] = {}
        for i in np.argsort(-cbm)[:200]:
            d = self.cdocs[i]
            if d["dataset_id"] not in best_col:
                best_col[d["dataset_id"]] = (float(cbm[i]), d["name"])
        pos = {d["id"]: i for i, d in enumerate(self.ddocs)}
        for did, (s, _) in best_col.items():
            if did in pos:
                score[pos[did]] += 0.1 * s
        # 같은 서비스의 여러 오퍼레이션이 비슷하게 맞으면 행이 많은 쪽을 앞세운다
        score = score + 0.015 * np.log10(np.array([self.by_id[d["id"]]["rows"] + 1 for d in self.ddocs], dtype=np.float32))
        order = np.argsort(-score)[:k]
        cos = (self.demb @ qv) if qv is not None else None
        out = []
        for i in order:
            did = self.ddocs[i]["id"]
            ds = self.by_id[did]
            c = float(cos[i]) if cos is not None else 0.0
            conf = "high" if (c >= 0.87 or (c >= 0.85 and bm[i] > 2)) else "medium" if (c >= 0.84 or bm[i] > 2) else "low"
            qr = query_region(q)
            dr = ds.get("default_sgg")
            if qr and dr and qr != dr:
                conf = "low"
            out.append({**self.summary(ds), "score": round(float(score[i]), 3), "cosine": round(c, 3),
                        "bm25": round(float(bm[i]), 2), "confidence": conf,
                        "matched_column": best_col.get(did, (0, None))[1]})
        return out

    def multi_search(self, q: str, k: int = 8) -> tuple[list[dict], list[str], list[str]]:
        """복합 질문은 조각별로 검색해 합친다. 반환: (결과, seed 데이터셋 id 목록)
        seed 는 조각별 상위 3개의 조합 중 '실측 조인율'이 가장 높은 조합으로 고른다."""
        parts = split_query(q)
        prefer = "emd" if re.search(r"\b(town|village|district|읍면동|동별|읍면별)\b", q, re.I) else \
                 "sgg" if re.search(r"\b(city|county|cities|시군|시군별|시군구)\b", q, re.I) else None
        merged: dict[str, dict] = {}
        per_part: list[list[str]] = []
        for i, part in enumerate([q] + parts):
            hits = self.search(part, 4 if i else k)
            if i:
                per_part.append([h["dataset_id"] for h in hits[:3]])
            for rank, h in enumerate(hits):
                h = dict(h)
                h["score"] = round(h["score"] * (1.0 if i == 0 else 1.15) - 0.02 * rank, 3)
                if h["dataset_id"] not in merged or merged[h["dataset_id"]]["score"] < h["score"]:
                    h["matched_part"] = part if i else None
                    merged[h["dataset_id"]] = h
        out = sorted(merged.values(), key=lambda h: -h["score"])
        seeds = self.best_combo(per_part, prefer) if per_part else [h["dataset_id"] for h in out[:3]]
        # seed 는 맨 앞으로
        out = [h for h in out if h["dataset_id"] in seeds] + [h for h in out if h["dataset_id"] not in seeds]
        return out[:max(k, len(seeds))], seeds, parts

    def best_combo(self, per_part: list[list[str]], prefer: str | None) -> list[str]:
        """조각별 후보(각 ≤3)의 조합 중 모든 쌍이 같은 수준으로 조인되며 최소 조인율이 최대인 조합."""
        from itertools import product
        edge: dict[tuple, float] = {}
        matched: dict[tuple, int] = {}
        for cands in per_part:
            for a in cands:
                for e in self.join_edges.get(a, []):
                    edge[(a, e["other"], e["level"])] = e["match_rate"]
                    matched[(a, e["other"], e["level"])] = e["matched"]
        best, best_score = None, -1.0
        for combo in product(*per_part):
            if len(set(combo)) < len(combo):
                continue
            for level in ("sgg", "emd"):
                pairs_ = [(a, b) for i, a in enumerate(combo) for b in combo[i + 1:]]
                rates = [edge.get((a, b, level), 0.0) for a, b in pairs_]
                if not rates:
                    continue
                mk = min(matched.get((a, b, level), 0) for a, b in pairs_)
                score = min(rates) * (mk / (mk + 2.0))        # 키 1~2개짜리 '완전 매칭'은 신뢰하지 않는다
                if prefer and level != prefer:
                    score *= 0.8
                # 각 조각의 1위 후보를 쓰면 가산 (검색 순위 존중)
                score += 0.1 * sum(1 for c, cands in zip(combo, per_part) if cands and cands[0] == c)
                if score > best_score:
                    best, best_score = list(combo), score
        if best is None or best_score <= 0.06:
            return [c[0] for c in per_part if c]
        return best

    def summary(self, ds: dict) -> dict:
        return {
            "dataset_id": ds["dataset_id"], "title": ds["title_ko"], "op": ds.get("op_summary", ""),
            "category": ds["category"], "provider": ds["provider"], "rows": ds["rows"],
            "update_cycle": ds.get("update_cycle", ""), "reference": ds.get("reference", ""),
            "region_keys": ds.get("region_keys", {}), "time_columns": ds["time_columns"][:3],
            "numeric_columns": ds["numeric_columns"][:8], "n_columns": len(ds["columns"]),
            "joinable_count": len(self.join_edges.get(ds["dataset_id"], [])),
        }

    # ---------- 그래프 탐색
    def neighbors(self, did: str, min_rate: float = 0.5, k: int = 10) -> list[dict]:
        seen, out = set(), []
        for e in sorted(self.join_edges.get(did, []), key=lambda e: (-e["match_rate"], -e["matched"])):
            key = (e["other"], e["level"])
            if e["match_rate"] < min_rate or key in seen:
                continue
            seen.add(key)
            o = self.by_id[e["other"]]
            out.append({**e, "title": o["title_ko"], "category": o["category"], "provider": o["provider"],
                        "rows": o["rows"], "level_label": LEVEL_LABEL[e["level"]]})
            if len(out) >= k:
                break
        return out

    def joinable_sets(self, seeds: list[str], candidates: list[str], min_rate: float = 0.5,
                      max_size: int = 4) -> list[dict]:
        """seed 를 포함하면서 후보 안에서 같은 키 수준으로 서로 전부 조인되는 집합(클리크)을 탐욕적으로 키운다."""
        edge = {}
        for a in set(seeds) | set(candidates):
            for e in self.join_edges.get(a, []):
                if e["match_rate"] >= min_rate:
                    edge[(a, e["other"], e["level"])] = e
        results = []
        for s in seeds:
            for level in ("sgg", "emd"):
                members = [s]
                pool = [c for c in candidates if c != s and (s, c, level) in edge]
                pool.sort(key=lambda c: -edge[(s, c, level)]["match_rate"])
                for c in pool:
                    if all((m, c, level) in edge for m in members):
                        members.append(c)
                    if len(members) >= max_size:
                        break
                if len(members) >= 2:
                    links = [{"a": a, "b": b, "a_col": edge[(a, b, level)]["my_col"], "b_col": edge[(a, b, level)]["other_col"],
                              "match_rate": edge[(a, b, level)]["match_rate"], "matched": edge[(a, b, level)]["matched"]}
                             for i, a in enumerate(members) for b in members[i + 1:]]
                    results.append({"level": level, "level_label": LEVEL_LABEL[level], "members": members,
                                    "titles": [self.by_id[m]["title_ko"] for m in members],
                                    "min_match_rate": min(l["match_rate"] for l in links), "links": links})
        results.sort(key=lambda r: (-round(r["min_match_rate"], 1), -len(r["members"]), -r["min_match_rate"]))
        uniq, seen = [], set()
        for r in results:
            key = (r["level"], tuple(sorted(r["members"])))
            if key not in seen:
                seen.add(key); uniq.append(r)
        return uniq[:6]

    def wiki(self, did: str) -> dict:
        ds = self.by_id[did]
        return {**self.summary(ds), "description": ds["description_ko"], "keywords": ds["keywords"],
                "api_url": ds.get("api_url", ""), "columns": ds["columns"],
                "neighbors": self.neighbors(did, 0.3, 15)}


# ---------- OperationSpec → SQL
class Compiler:
    """
    spec = {
      "sources": [
        {"alias": "a", "dataset_id": "15143795",
         "key": {"column": "fcltAddr", "level": "sgg"},          # level: sgg | emd | raw
         "filters": [{"column": "dutyAddr", "op": "like", "value": "경상북도%"}],
         "metrics": [{"name": "welfare", "agg": "count", "column": "*"}]},
        ...],
      "join": "inner" | "left",
      "order_by": [{"name": "welfare", "desc": true}],
      "limit": 50
    }
    """
    AGG = {"count": "count", "sum": "sum", "avg": "avg", "min": "min", "max": "max", "count_distinct": "count(distinct", "count_if": "count_if"}
    OPS = {"=": "=", "!=": "<>", ">": ">", "<": "<", ">=": ">=", "<=": "<=", "like": "LIKE", "in": "IN"}

    def __init__(self, catalog: Catalog) -> None:
        self.cat = catalog
        self.con = duckdb.connect(str(DB), read_only=True)
        self.con.create_function("sgg", lambda v: sgg_key(v), ["VARCHAR"], "VARCHAR", null_handling="special")
        self.con.create_function("emd", lambda v: emd_key(v), ["VARCHAR"], "VARCHAR", null_handling="special")
        self.con.create_function("emd2", lambda v, d: emd_key(v, d), ["VARCHAR", "VARCHAR"], "VARCHAR", null_handling="special")
        self._lock = threading.Lock()

    @staticmethod
    def q(ident: str) -> str:
        if not re.fullmatch(r"[0-9A-Za-z가-힣_]+", ident):
            raise ValueError(f"invalid identifier: {ident!r}")
        return f'"{ident}"'

    def _check_col(self, ds: dict, col: str) -> str:
        if col == "*":
            return "*"
        names = {c["name"] for c in ds["columns"]}
        if col not in names:
            low = {c.lower(): c for c in names}
            if col.lower() in low:
                return low[col.lower()]
            raise ValueError(f"column {col!r} not in dataset {ds['dataset_id']}")
        return col

    def _key_expr(self, ds: dict, key: dict | None) -> str | None:
        if not key:
            return None
        col = self._check_col(ds, key["column"])
        level = key.get("level", "raw")
        if level == "sgg":
            return f"sgg({self.q(col)})"
        if level == "emd":
            d = ds.get("default_sgg")
            return f"emd2({self.q(col)}, '{d}')" if d and re.fullmatch(r"[가-힣]+", d) else f"emd({self.q(col)})"
        return f"CAST({self.q(col)} AS VARCHAR)"

    def _filter_sql(self, ds: dict, f: dict) -> tuple[str, list]:
        col = self.q(self._check_col(ds, f["column"]))
        op = self.OPS[f.get("op", "=")]
        v = f.get("value")
        if op == "IN":
            vals = v if isinstance(v, list) else [v]
            return f"{col} IN ({','.join('?' * len(vals))})", list(map(str, vals))
        if op in (">", "<", ">=", "<="):
            return f"TRY_CAST({col} AS DOUBLE) {op} ?", [float(v)]
        return f"{col} {op} ?", [str(v)]

    def _metric_sql(self, ds: dict, m: dict) -> str:
        agg = m.get("agg", "count")
        if agg not in self.AGG:
            raise ValueError(f"unknown agg {agg}")
        col = self._check_col(ds, m.get("column", "*"))
        name = self.q(m.get("name") or f"{agg}_{col}".replace("*", "all"))
        if agg == "count":
            inner = "*" if col == "*" else self.q(col)
            return f"count({inner}) AS {name}"
        if agg == "count_distinct":
            return f"count(DISTINCT {self.q(col)}) AS {name}"
        if agg == "count_if":
            v = str(m.get("value", "Y")).replace("'", "''")
            return f"count(*) FILTER (WHERE {self.q(col)} = '{v}') AS {name}"
        return f"{agg}(TRY_CAST(REPLACE({self.q(col)}, ',', '') AS DOUBLE)) AS {name}"

    def compile(self, spec: dict) -> tuple[str, list, list[dict]]:
        srcs = spec.get("sources") or []
        if not srcs:
            raise ValueError("spec.sources is empty")
        ctes, params, meta = [], [], []
        for i, s in enumerate(srcs):
            ds = self.cat.by_id.get(str(s["dataset_id"]))
            if not ds:
                raise ValueError(f"unknown dataset {s['dataset_id']}")
            alias = re.sub(r"\W", "", s.get("alias") or f"s{i}") or f"s{i}"
            kexpr = self._key_expr(ds, s.get("key"))
            where, p = [], []
            for f in s.get("filters", []):
                w, pp = self._filter_sql(ds, f)
                where.append(w); p.extend(pp)
            if s.get("columns") and not s.get("metrics"):
                # 집계 없이 원시 컬럼 선택 (지역 키가 없는 wide 테이블 등)
                cols = [self.q(self._check_col(ds, c)) for c in s["columns"]]
                sql = f"SELECT {', '.join(cols)} FROM {self.q(ds['table'])}"
                if where:
                    sql += " WHERE " + " AND ".join(where)
                ctes.append(f"{alias} AS ({sql})"); params.extend(p)
                meta.append({"alias": alias, "dataset_id": ds["dataset_id"], "title": ds["title_ko"],
                             "table": ds["table"], "key_expr": None, "where": where, "params": p})
                continue
            metrics = [self._metric_sql(ds, m) for m in s.get("metrics", [])] or ["count(*) AS " + self.q(f"{alias}_rows")]
            group_by = s.get("group_by", [])
            gcols = [self.q(self._check_col(ds, g)) for g in group_by]
            sel = ([f"{kexpr} AS k"] if kexpr else []) + [f"{g} AS {g}" for g in gcols] + metrics
            sql = f"SELECT {', '.join(sel)} FROM {self.q(ds['table'])}"
            if where:
                sql += " WHERE " + " AND ".join(where)
            gb = ([ "k"] if kexpr else []) + gcols
            if gb:
                sql += " GROUP BY " + ", ".join(gb)
            ctes.append(f"{alias} AS ({sql})")
            params.extend(p)
            meta.append({"alias": alias, "dataset_id": ds["dataset_id"], "title": ds["title_ko"],
                         "table": ds["table"], "key_expr": kexpr, "where": where, "params": p})
        if len(srcs) == 1:
            m = meta[0]
            sql = f"WITH {ctes[0]} SELECT * FROM {m['alias']}" + (" WHERE k IS NOT NULL" if m["key_expr"] else "")
        else:
            if any(m["key_expr"] is None for m in meta):
                raise ValueError("every source needs a key when joining")
            join = "LEFT JOIN" if spec.get("join") == "left" else "JOIN"
            first = meta[0]["alias"]
            body = f"SELECT {first}.k AS key, " + ", ".join(
                f"{m['alias']}.* EXCLUDE (k)" for m in meta) + f" FROM {first}"
            for m in meta[1:]:
                body += f" {join} {m['alias']} ON {first}.k = {m['alias']}.k"
            body += f" WHERE {first}.k IS NOT NULL"
            sql = "WITH " + ", ".join(ctes) + " " + body
        ob = spec.get("order_by") or []
        if ob:
            sql += " ORDER BY " + ", ".join(f"{self.q(o['name'])} {'DESC' if o.get('desc') else 'ASC'}" for o in ob)
        sql += f" LIMIT {int(spec.get('limit', 100))}"
        return sql, params, meta

    def run(self, spec: dict, output_schema: dict | None = None) -> dict:
        sql, params, meta = self.compile(spec)
        with self._lock:
            cur = self.con.execute(sql, params)
            cols = [d[0] for d in cur.description]
            rows = cur.fetchall()
            dropped = self._dropped_detail(meta) if len(meta) > 1 else []
        def clean(v):
            if isinstance(v, float) and (math.isnan(v) or math.isinf(v)):
                return None
            return v
        cleaned_rows = [[clean(v) for v in r] for r in rows]
        result = {"sql": sql, "params": params, "columns": cols,
                  "rows": cleaned_rows, "row_count": len(cleaned_rows),
                  "sources": [{k: m[k] for k in ("alias", "dataset_id", "title")} for m in meta],
                  "dropped_detail": dropped}

        if output_schema is not None:
            result["output"] = self.shape_json(cleaned_rows, cols, output_schema)
            result["output_schema"] = output_schema

        return result

    @staticmethod
    def shape_json(rows: list[list], columns: list[str], schema: dict) -> list[dict]:
        properties = schema.get("properties")

        if schema.get("type", "object") != "object" or not isinstance(properties, dict):
            raise ValueError("output schema must be an object schema with properties")

        indexes = {}
        for name, definition in properties.items():
            if not re.fullmatch(r"[0-9A-Za-z가-힣_]+", str(name)):
                raise ValueError(f"invalid output property: {name!r}")
            column = name
            if isinstance(definition, dict):
                column = definition.get("column") or definition.get("from") or name
            if column not in columns:
                raise ValueError(f"output column {column!r} is not in the result")
            indexes[name] = columns.index(column)

        return [{name: row[index] for name, index in indexes.items()} for row in rows]

    def _dropped_detail(self, meta: list[dict]) -> list[dict]:
        """각 소스의 정규화 키 집합을 구해 교집합에 못 든 키를 보고한다."""
        keysets = []
        for m in meta:
            w = (" WHERE " + " AND ".join(m["where"])) if m["where"] else ""
            rows = self.con.execute(
                f"SELECT DISTINCT {m['key_expr']} AS k FROM {self.q(m['table'])}{w}", m["params"]).fetchall()
            keysets.append({r[0] for r in rows if r[0] is not None})
        inter = set.intersection(*keysets) if keysets else set()
        out = []
        for m, ks in zip(meta, keysets):
            missing = sorted(ks - inter)
            out.append({"alias": m["alias"], "dataset_id": m["dataset_id"], "title": m["title"],
                        "keys": len(ks), "matched": len(inter),
                        "match_rate": round(len(inter) / len(ks), 3) if ks else 0.0,
                        "dropped": len(missing), "dropped_keys": missing[:30]})
        return out


def suggest_spec(cat: Catalog, members: list[str], level: str, links: list[dict]) -> dict:
    """조인 집합 → 기본 OperationSpec (각 소스 count, 첫 numeric 컬럼 sum)"""
    keycol: dict[str, str] = {}
    for l in links:
        keycol.setdefault(l["a"], l["a_col"]); keycol.setdefault(l["b"], l["b_col"])
    sources = []
    for i, did in enumerate(members):
        ds = cat.by_id[did]
        alias = chr(ord("a") + i)
        metrics = [{"name": f"{alias}_count", "agg": "count", "column": "*"}]
        bad = re.compile(r"(^|_)(no|id|cd|code|sn|row|seq|zip|tel|telno|yr|year|ym|mt|month|de|dt|date|la|lo|lat|lng|lon|x|y|sm|se|ordr|wdate)($|_)|_no$|_cd$|no$|cd$|id$")
        good = re.compile(r"(co|cnt|count|nmpr|popltn|total|sum|amt|ar|cpcty|qy|capct|area|psncpa|price|rate|aceptnc)", re.I)
        num = [c for c in ds["numeric_columns"] if not bad.search(c.lower()) and c not in ("spm_row", "ts_row", "innerTableRowNum")]
        num.sort(key=lambda c: (0 if good.search(c) else 1))
        if num:
            agg = "avg" if re.search(r"(dnsty|avg|mean|rate|ratio|temp|pm10|pm25|price|prc|unit)", num[0], re.I) else "sum"
            metrics.append({"name": f"{alias}_{agg}_{num[0]}"[:40], "agg": agg, "column": num[0]})
        yn = [c for c in ds["columns"] if c["role"] == "text" and c.get("samples") and set(c["samples"]) <= {"Y", "N", "y", "n"}]
        for c in yn[:1]:
            metrics.append({"name": f"{alias}_{c['name']}_Y"[:40], "agg": "count_if", "column": c["name"], "value": "Y"})
        sources.append({"alias": alias, "dataset_id": did, "title": ds["title_ko"],
                        "key": {"column": keycol.get(did) or ds.get("region_keys", {}).get(level), "level": level},
                        "filters": [], "metrics": metrics})
    return {"sources": sources, "join": "inner", "order_by": [{"name": "a_count", "desc": True}], "limit": 100}


def single_spec(cat: Catalog, did: str, prefer: str | None = None, region: str | None = None) -> dict:
    """한 데이터셋용 기본 스펙: 지역키가 있으면 지역별 집계, 없으면 원시 컬럼.
    질문에 시군이 있고 데이터셋이 광역이면 그 시군으로 필터하고 읍면동으로 내려간다."""
    ds = cat.by_id[did]
    rk = ds.get("region_keys") or {}
    if region and not ds.get("default_sgg") and rk.get("sgg"):
        lvl = "emd" if rk.get("emd") else "sgg"
        spec = suggest_spec(cat, [did], lvl, [])
        spec["sources"][0]["key"] = {"column": rk[lvl], "level": lvl}
        spec["sources"][0]["filters"] = [{"column": rk["sgg"], "op": "like", "value": f"%{region[:-1]}%"}]
        return spec
    # 단일 시군 데이터셋은 읍면동, 광역 데이터셋은 시군구 기본
    lvl = prefer if prefer in ("sgg", "emd") and rk.get(prefer) else None
    if not lvl:
        lvl = "emd" if (ds.get("default_sgg") and rk.get("emd")) else ("sgg" if rk.get("sgg") else ("emd" if rk.get("emd") else None))
    if lvl:
        spec = suggest_spec(cat, [did], lvl, [])
        spec["sources"][0]["key"] = {"column": rk[lvl], "level": lvl}
        return spec
    cols = [c["name"] for c in ds["columns"] if c["name"] not in ("spm_row", "ts_row", "no", "innerTableRowNum", "collection_dt")][:12]
    return {"sources": [{"alias": "a", "dataset_id": did, "title": ds["title_ko"], "columns": cols, "filters": []}], "limit": 200}


PLAN_SYSTEM = """You are the planner for GovData Studio. You never compute, fabricate, or return data rows.
You only produce an OperationSpec JSON that the local DuckDB compiler executes. Use ONLY dataset_ids and
column names given in the context. Include every distinct concept needed to answer the question when the
verified joinable sets contain it. Do not collapse a multi-concept policy question into one convenient
dataset. For heat-risk or vulnerability questions, prefer an 읍면동 (emd) plan and include population,
weather or temperature, and shelter or evacuation resources when those verified candidates exist.
Keys use level \"sgg\" for city/county (시군구), \"emd\" for town (읍면동), and \"raw\" for exact-value keys.
Metrics use count|sum|avg|min|max|count_distinct|count_if. Filters use =, !=, >, <, >=, <=, like, or in.
Every identifier must contain only letters, numbers, Korean characters, or underscores. Do not use null
filter values. Keep the limit at 100 or less. Return only JSON."""

IDENTIFIER_SCHEMA = {"type": "string", "minLength": 1, "pattern": r"^[0-9A-Za-z가-힣_]+$"}

PLAN_OUTPUT_SCHEMA = {
    "type": "object",
    "additionalProperties": False,
    "required": ["spec", "explanation", "title"],
    "properties": {
        "spec": {
            "type": "object",
            "additionalProperties": False,
            "required": ["sources", "join", "order_by", "limit"],
            "properties": {
                "sources": {
                    "type": "array",
                    "minItems": 1,
                    "maxItems": 4,
                    "items": {
                        "type": "object",
                        "additionalProperties": False,
                        "required": ["alias", "dataset_id", "key", "filters", "metrics", "columns", "group_by"],
                        "properties": {
                            "alias": IDENTIFIER_SCHEMA,
                            "dataset_id": IDENTIFIER_SCHEMA,
                            "key": {
                                "anyOf": [
                                    {
                                        "type": "object",
                                        "additionalProperties": False,
                                        "required": ["column", "level"],
                                        "properties": {
                                            "column": IDENTIFIER_SCHEMA,
                                            "level": {"type": "string", "enum": ["sgg", "emd", "raw"]},
                                        },
                                    },
                                    {"type": "null"},
                                ]
                            },
                            "filters": {
                                "type": "array",
                                "items": {
                                    "type": "object",
                                    "additionalProperties": False,
                                    "required": ["column", "op", "value"],
                                    "properties": {
                                        "column": IDENTIFIER_SCHEMA,
                                        "op": {"type": "string", "enum": ["=", "!=", ">", "<", ">=", "<=", "like", "in"]},
                                        "value": {
                                            "anyOf": [
                                                {"type": "string"},
                                                {"type": "number"},
                                                {"type": "array", "items": {"type": "string"}},
                                            ]
                                        },
                                    },
                                },
                            },
                            "metrics": {
                                "type": "array",
                                "items": {
                                    "type": "object",
                                    "additionalProperties": False,
                                    "required": ["name", "agg", "column", "value"],
                                    "properties": {
                                        "name": IDENTIFIER_SCHEMA,
                                        "agg": {
                                            "type": "string",
                                            "enum": ["count", "sum", "avg", "min", "max", "count_distinct", "count_if"],
                                        },
                                        "column": {"anyOf": [IDENTIFIER_SCHEMA, {"type": "string", "const": "*"}]},
                                        "value": {"anyOf": [{"type": "string"}, {"type": "null"}]},
                                    },
                                },
                            },
                            "columns": {
                                "anyOf": [
                                    {"type": "array", "items": IDENTIFIER_SCHEMA},
                                    {"type": "null"},
                                ]
                            },
                            "group_by": {"type": "array", "items": IDENTIFIER_SCHEMA},
                        },
                    },
                },
                "join": {"anyOf": [{"type": "string", "enum": ["inner", "left"]}, {"type": "null"}]},
                "order_by": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "additionalProperties": False,
                        "required": ["name", "desc"],
                        "properties": {
                            "name": IDENTIFIER_SCHEMA,
                            "desc": {"type": "boolean"},
                        },
                    },
                },
                "limit": {"type": "integer", "minimum": 1, "maximum": 100},
            },
        },
        "explanation": {"type": "string", "minLength": 1, "maxLength": 240},
        "title": {"type": "string", "minLength": 1, "maxLength": 120},
    },
}


IDENTIFIER_PATTERN = re.compile(r"^[0-9A-Za-z가-힣_]+$")
FILTER_OPERATORS = {"=", "!=", ">", "<", ">=", "<=", "like", "in"}
AGGREGATIONS = {"count", "sum", "avg", "min", "max", "count_distinct", "count_if"}


def _is_identifier(value: Any) -> bool:
    return isinstance(value, str) and bool(IDENTIFIER_PATTERN.fullmatch(value.strip()))


def _operation_spec_contract_error(spec: Any) -> str | None:
    if not isinstance(spec, dict):
        return "spec must be an object"

    sources = spec.get("sources")
    if not isinstance(sources, list) or not sources or len(sources) > 4:
        return "sources must contain between one and four items"

    for index, source in enumerate(sources):
        if not isinstance(source, dict):
            return f"sources[{index}] must be an object"
        if not _is_identifier(source.get("alias")):
            return f"sources[{index}].alias is not an identifier"
        if not _is_identifier(source.get("dataset_id")):
            return f"sources[{index}].dataset_id is not an identifier"

        key = source.get("key")
        if key is not None and (
            not isinstance(key, dict)
            or not _is_identifier(key.get("column"))
            or key.get("level") not in {"sgg", "emd", "raw"}
        ):
            return f"sources[{index}].key is invalid"

        filters = source.get("filters", [])
        if not isinstance(filters, list):
            return f"sources[{index}].filters must be an array"
        for filter_index, item in enumerate(filters):
            if not isinstance(item, dict) or not _is_identifier(item.get("column")):
                return f"sources[{index}].filters[{filter_index}].column is invalid"
            if item.get("op") not in FILTER_OPERATORS:
                return f"sources[{index}].filters[{filter_index}].op is invalid"
            value = item.get("value")
            valid_value = (
                isinstance(value, str)
                or (isinstance(value, (int, float)) and not isinstance(value, bool))
                or (isinstance(value, list) and all(isinstance(entry, str) for entry in value))
            )
            if not valid_value:
                return f"sources[{index}].filters[{filter_index}].value is invalid"

        metrics = source.get("metrics", [])
        if not isinstance(metrics, list):
            return f"sources[{index}].metrics must be an array"
        for metric_index, item in enumerate(metrics):
            if not isinstance(item, dict):
                return f"sources[{index}].metrics[{metric_index}] must be an object"
            if not _is_identifier(item.get("name")) or item.get("agg") not in AGGREGATIONS:
                return f"sources[{index}].metrics[{metric_index}] name or agg is invalid"
            if item.get("column") != "*" and not _is_identifier(item.get("column")):
                return f"sources[{index}].metrics[{metric_index}].column is invalid"
            if item.get("value") is not None and (
                not isinstance(item.get("value"), str) or not item["value"].strip()
            ):
                return f"sources[{index}].metrics[{metric_index}].value is invalid"

        columns = source.get("columns")
        if columns is not None and (not isinstance(columns, list) or not all(_is_identifier(column) for column in columns)):
            return f"sources[{index}].columns is invalid"
        group_by = source.get("group_by", [])
        if not isinstance(group_by, list) or not all(_is_identifier(column) for column in group_by):
            return f"sources[{index}].group_by is invalid"

    if spec.get("join") not in {None, "inner", "left"}:
        return "join is invalid"
    order_by = spec.get("order_by", [])
    if not isinstance(order_by, list):
        return "order_by must be an array"
    for index, order in enumerate(order_by):
        if not isinstance(order, dict) or not _is_identifier(order.get("name")) or not isinstance(order.get("desc"), bool):
            return f"order_by[{index}] is invalid"

    limit = spec.get("limit", 100)
    if not isinstance(limit, int) or isinstance(limit, bool) or limit < 1 or limit > 1000:
        return "limit is invalid"
    return None


def _planner_contract_error(plan: Any) -> str | None:
    if not isinstance(plan, dict):
        return "planner response must be an object"
    if not isinstance(plan.get("title"), str) or not plan["title"].strip():
        return "title is missing"
    if not isinstance(plan.get("explanation"), str) or not plan["explanation"].strip():
        return "explanation is missing"
    return _operation_spec_contract_error(plan.get("spec"))


def _codex_enabled() -> bool:
    return os.environ.get("GOVDATA_AI_ENABLED", "false").lower() == "true" and os.environ.get(
        "GOVDATA_AI_PROVIDER", "codex"
    ).lower() == "codex"


def _planner_intent_hints(query: str) -> list[str]:
    hints = []
    if re.search(r"폭염|더위|열|취약", query):
        hints.append("폭염 취약도는 노령 인구, 읍면동별 기온, 무더위쉼터 또는 대피 장소를 함께 비교해요.")
    if re.search(r"우선순위|취약한|위험한", query):
        hints.append("우선순위 결과는 위험 요인과 보호 자원을 같은 지역 키로 집계해요.")
    return hints


def _planner_context(cat: Catalog, query: str, candidates: list[dict], sets: list[dict]) -> dict:
    brief = []
    for candidate in candidates[:6]:
        dataset = cat.by_id[candidate["dataset_id"]]
        columns = [
            {"name": column["name"], "desc": column["desc_ko"][:80], "role": column["role"]}
            for column in dataset["columns"][:48]
        ]
        brief.append(
            {
                "dataset_id": dataset["dataset_id"],
                "title": dataset["title_ko"],
                "rows": dataset["rows"],
                "region_keys": dataset.get("region_keys"),
                "time_columns": dataset.get("time_columns", []),
                "numeric_columns": dataset.get("numeric_columns", []),
                "columns": columns,
            }
        )

    return {
        "question": query,
        "intent_hints": _planner_intent_hints(query),
        "candidates": brief,
        "verified_joinable_sets": sets[:4],
    }


def _codex_message(stdout: str) -> str:
    latest = ""
    for line in stdout.splitlines():
        if not line.strip():
            continue
        try:
            event = json.loads(line)
        except json.JSONDecodeError:
            continue
        item = event.get("item") if isinstance(event, dict) else None
        if isinstance(item, dict) and item.get("type") == "agent_message" and isinstance(item.get("text"), str):
            latest = item["text"]
    return latest or stdout.strip()


def _json_object(text: str) -> dict:
    message = _codex_message(text).strip()
    candidates = [message]
    unfenced = re.sub(r"^```(?:json)?\s*|\s*```$", "", message, flags=re.I)
    if unfenced not in candidates:
        candidates.append(unfenced)
    start, end = message.find("{"), message.rfind("}")
    if start >= 0 and end > start:
        candidates.append(message[start : end + 1])

    for candidate in candidates:
        try:
            value = json.loads(candidate)
        except json.JSONDecodeError:
            continue
        if isinstance(value, dict):
            return value

    raise RuntimeError("Codex headless planner returned invalid JSON")


def codex_plan(cat: Catalog, query: str, candidates: list[dict], sets: list[dict]) -> dict:
    context = _planner_context(cat, query, candidates, sets)
    prompt = "\n\n".join(
        [
            PLAN_SYSTEM,
            "Run no tools and do not read or write files. Return exactly one JSON object matching this schema:",
            json.dumps(PLAN_OUTPUT_SCHEMA, ensure_ascii=False),
            "Planning context:",
            json.dumps(context, ensure_ascii=False),
        ]
    )
    command = os.environ.get("CODEX_CLI_PATH", "codex").strip() or "codex"

    with tempfile.TemporaryDirectory(prefix="mobydick-codex-") as directory:
        schema_path = Path(directory) / "planner-schema.json"
        schema_path.write_text(json.dumps(PLAN_OUTPUT_SCHEMA), encoding="utf-8")
        try:
            completed = subprocess.run(
                [
                    command,
                    "exec",
                    "--ephemeral",
                    "--json",
                    "--sandbox",
                    "read-only",
                    "--skip-git-repo-check",
                    "--output-schema",
                    str(schema_path),
                    "-C",
                    directory,
                ],
                cwd=directory,
                env=os.environ.copy(),
                input=prompt,
                capture_output=True,
                text=True,
                timeout=int(os.environ.get("GOVDATA_CODEX_TIMEOUT_SECONDS", "120")),
                check=False,
            )
        except FileNotFoundError as error:
            raise RuntimeError(f"Codex CLI was not found: {command}") from error
        except subprocess.TimeoutExpired as error:
            raise RuntimeError("Codex headless planner timed out") from error

        if completed.returncode != 0:
            detail = completed.stderr.strip()[-400:]
            raise RuntimeError(f"Codex headless planner failed: {detail or completed.returncode}")

        return _json_object(completed.stdout)


def pipeline_for_spec(cat: Catalog, spec: dict) -> dict:
    nodes = []
    links = []
    source_ids = []

    for index, source in enumerate(spec.get("sources", [])):
        dataset_id = str(source.get("dataset_id", ""))
        dataset = cat.by_id.get(dataset_id, {})
        node_id = f"source-{index + 1}"
        source_ids.append(node_id)
        nodes.append(
            {
                "id": node_id,
                "kind": "SOURCE",
                "title": dataset.get("title_ko", dataset_id or "데이터 소스"),
                "subtitle": f"{dataset.get('rows', 0):,}행 · {dataset_id}",
                "dataset_id": dataset_id,
                "position": {"x": 64, "y": 64 + index * 128},
            }
        )

    tail = source_ids[0] if len(source_ids) == 1 else None
    if len(source_ids) > 1:
        join_id = "join-1"
        nodes.append(
            {
                "id": join_id,
                "kind": "JOIN",
                "title": "검증된 지역 조인",
                "subtitle": "실측 매칭 키로 결합",
                "dataset_id": None,
                "position": {"x": 336, "y": 128},
            }
        )
        links.extend({"id": f"link-{source_id}-{join_id}", "source": source_id, "target": join_id} for source_id in source_ids)
        tail = join_id

    if tail is None:
        raise ValueError("OperationSpec has no sources")

    transform_id = "transform-1"
    nodes.append(
        {
            "id": transform_id,
            "kind": "TRANSFORM",
            "title": "질문 분석",
            "subtitle": "선언적 OperationSpec 실행",
            "dataset_id": None,
            "position": {"x": 608, "y": 128},
        }
    )
    links.append({"id": f"link-{tail}-{transform_id}", "source": tail, "target": transform_id})

    output_id = "output-1"
    nodes.append(
        {
            "id": output_id,
            "kind": "OUTPUT",
            "title": "JSON 결과",
            "subtitle": "API · MCP 출력",
            "dataset_id": None,
            "position": {"x": 880, "y": 128},
        }
    )
    links.append({"id": f"link-{transform_id}-{output_id}", "source": transform_id, "target": output_id})
    return {"nodes": nodes, "links": links}
