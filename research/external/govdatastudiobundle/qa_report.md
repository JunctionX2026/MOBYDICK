# QA 리포트 — GovData Studio (2026-08-22)

30개 질문(한국어 20 + 영어 10)을 실제 `/api/recommend → /api/run` 경로로 4회 반복 실행하며 개선했다.
원본 로그: `data/qa_run1.log`(개선 전) … `data/qa_run4.log`(개선 후), 구조화 결과 `data/qa_results.json`.

## 요약

| 지표 | 개선 전 (run1) | 개선 후 (run4) |
|---|---|---|
| 올바른 데이터셋이 1위로 검색됨 | 14 / 20 | **28 / 30** (나머지 2는 데이터 자체가 없음 → weak 표시) |
| 단일 주제 질문이 엉뚱한 조인으로 실행됨 | 8건 | **0건** |
| 실행 결과가 의미 있는 표(≥2행, 키 NULL 없음) | 15 / 20 | **29 / 30** |
| 적재 데이터셋 / 행 / 실측 조인 쌍 | 218 / 337k / 1,863 | **226 / 361k / 2,106** |
| 응답 시간 (recommend, warm) | 0.1–0.4 s | 0.1–0.4 s |

## 발견한 문제와 수정

| # | 증상 (실제 쿼리) | 원인 | 수정 |
|---|---|---|---|
| 1 | `어린이보호구역 CCTV 설치율` → 공중화장실·불법주정차 CCTV와 강제 조인 | 질문 조각이 1개여도 항상 joinable set을 자동 적용 | 조각 ≥2 또는 "vs/and/비교/결합" 있을 때만 `mode=join`. 단일 주제는 단일 데이터셋 스펙을 자동 실행, 조인 집합은 "Could also be joined with"로만 제안 |
| 2 | `구미시 버스 정류장` → `[None, 361]` | 단일 소스 집계에서 키 NULL 행 누락 안 함 + 단일 시군 데이터셋을 시군구로 묶음 | 단일 소스 `WHERE k IS NOT NULL`; 단일 시군 데이터셋은 읍면동(emd) 기본 |
| 3 | `영천 약국/의료기관/일반음식점/CCTV`, `포항 대기오염` 없음 | data.go.kr 검색에서 타 지역 동명 API에 오매칭 → 제외됨 | 형제 서비스의 오퍼레이션 패턴(`/getResult`, `/get{Name}`)으로 직접 호출 → **8개 데이터셋 복구**(24k 행). 고유 id `ep_{service}` 부여(페이지 id 충돌 방지) |
| 4 | `영천 약국 vs 의료기관` → 동물약국과 조인 | 키 1개짜리 "100% 매칭"이 정상 쌍보다 높게 평가됨 | 조합 점수 = `min(rate) × matched/(matched+2)` (키 수가 적으면 할인) |
| 5 | `hospitals` 조각이 분만병원 오퍼레이션(155행)을 고름 | 같은 서비스의 오퍼레이션들이 동점 | 검색 점수에 `0.015·log10(rows)` prior |
| 6 | `where are EV charging stations`, `시군별 전통시장` → 엉뚱한 데이터가 high로 표시 | 정규화 점수만 있고 절대 신뢰도 없음 | 코사인·BM25 기반 `confidence`(high/medium/low) + 질문 시군 ≠ 데이터셋 시군이면 low. UI에 "Weak match" 배너 |
| 7 | `안동 의료기관` → 영주 금연치료 의료기관 | 지역 불일치 감지 없음 | (6)의 지역 불일치 + 광역 데이터셋이면 질문 시군으로 `LIKE` 필터 후 읍면동 집계 → 안동 읍면동별 병의원 27행 |
| 8 | `버스 정류장` ↔ `정거장`, `미세먼지` ↔ `대기오염` 불일치 | BM25는 표기 변형에 약함 | 한국어 동의어 사전(KO_SYN) 질의 확장 |
| 9 | CCTV "설치율"을 셀 수 없음 (sum만 가능) | Y/N 컬럼용 집계 부재 | `count_if` 집계 추가; 샘플이 {Y,N}인 컬럼은 기본 스펙에 자동 포함 (`a_cctvYN_Y`) |
| 10 | 대기오염 농도를 `sum` | 밀도/비율 컬럼에 sum은 무의미 | 컬럼명에 dnsty/rate/price 등이 있으면 `avg` |
| 11 | 영어 복합 질문에서 도시명이 두 번째 조각에 안 붙음 | `Yeongju solar permits vs public buildings` → 두 번째 조각이 상주 데이터 | 첫 조각의 지역명을 전 조각에 전파 |
| 12 | 병·의원 20,000행 캡(전국) | 국가 API | `Q0=경상북도`로 재수집 → 경북 3,361건 전량 |

## 개선 후 실행 결과 (run4, 발췌)

| 질문 | 모드 | 선택된 데이터셋 | 수준·매칭 | 결과 |
|---|---|---|---|---|
| 시군별 노인복지시설 vs 병의원 | join | 경북 노인복지시설 × 병·의원(경북) | sgg 100% | 22행 — 포항 167 / 662 |
| 어린이보호구역 CCTV 설치율 낮은 시군 | single | 경북 어린이보호구역 | sgg | 22행 — 포항 206곳 중 CCTV 29 (14%) |
| 영천시 약국 vs 의료기관 읍면동별 | join | 영천 약국 × 영천 의료기관 (복구 데이터) | emd 100%/31% | 5행 — 금호읍 4 / 14 |
| 상주시 일반음식점 vs 담배소매인 | join | 상주 일반음식점 × 담배소매인 | emd 86% | 19행 — 함창읍 94 / 34 |
| 포항 대기오염 측정소별 | single | 포항 대기오염 환경 (복구 데이터) | emd | 10개 측정소, SO₂ 평균 |
| 안동 의료기관 | single + 지역필터 | 병·의원(경북) → 안동 | emd | 27행 — 풍산읍 11… |
| public toilets, social enterprises, village companies by city | join | 공중화장실 × 사회적기업 × 마을기업 | sgg 100%×3 | 22행 |
| Gumi: senior centers, child zones, restaurants by town | join | 구미 경로당 × 어린이보호구역 × 음식점 | emd 97% | 32행 |
| 영천 CCTV vs 일반음식점 읍면동별 | join | 영천 CCTV × 일반음식점 (둘 다 복구) | emd 100%/93% | 37행 — 완산동 CCTV 173 / 음식점 210 |
| Gumi factories and waste emitters | join **WEAK** | (구미엔 없음) 영천 공장 × 폐기물배출 | emd 96% | 26행, 배너로 경고 |
| where are EV charging stations | single **weak** | 영천 연료별 자동차 등록 (최근접) | — | 경고 표시 |
| 시군별 전통시장 | single **weak** | (전통시장 API가 0건 반환) | — | 경고 표시 |

## 남은 한계 (정직하게)

- **없는 데이터는 못 만든다**: 전통시장(API 0건), 협동조합(0건), 안동시 자체 API 14건(`NO OPENAPI SERVICE`), 구미 도서관·상주 대금지급(폐기). UI는 weak로만 표시.
- **조인율은 `교집합 / min(|A|,|B|)`**: 작은 테이블 기준이라 낙관적일 수 있음. 그래서 실행 결과에 소스별 `dropped_detail`(키 수·매칭·탈락 키)을 항상 같이 보여준다.
- **기본 스펙은 휴리스틱**(count + 첫 수치 컬럼 sum/avg + Y/N count_if). "설치율 %" 같은 파생 지표는 `Plan with Claude`(API 키 필요) 또는 스펙 수동 편집.
- **영문 질의**는 소형 e5 모델 + 용어집(EN→KO 200여 항목, 구문 30여 개) 의존. 용어집에 없는 단어는 매칭이 약해질 수 있다 (`data/qa_run4.log`에서 low 표시 확인).
- 병·의원 `getHsptlBassInfoInqire`/`FullDown`은 `Q0` 필터를 무시해 60k 중 경북 2,600건만 남김(부분). 완전한 건 `ListInfo`(3,361).

## 재현

```bash
.venv/bin/uvicorn app.server:app --port 8000 &
.venv/bin/python - <<'EOF'
import json, urllib.request
def post(p,b): return json.load(urllib.request.urlopen(urllib.request.Request("http://127.0.0.1:8000"+p, data=json.dumps(b).encode(), headers={"content-type":"application/json"})))
r = post("/api/recommend", {"query": "시군별 노인복지시설 vs 병의원"})
spec = r["joinable_sets"][0]["spec"] if r["mode"] == "join" else r["single_spec"]
print(post("/api/run", {"spec": spec})["rows"][:5])
EOF
```
