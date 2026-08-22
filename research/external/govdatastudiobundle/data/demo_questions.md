# 데모 질문 10선 — 전부 DuckDB(`data/gbdata.duckdb`)에서 실행 검증됨

`sgg(v)` / `emd(v)` 는 `scripts/3_build_kg.py` 의 `sgg_key` / `emd_key` 를 DuckDB UDF로 등록한 것
(`con.create_function('sgg', sgg_key, ['VARCHAR'], 'VARCHAR', null_handling='special')`).

| # | 질문 (한국어) | 조인 수준 | 데이터셋 | 보기 좋은 이유 |
|---|---|---|---|---|
| 1 | 경북 시군별 노인복지시설 수와 병·의원 수를 비교하면? | sgg 22/22 | 경상북도_노인복지시설 현황조회 × 국립중앙의료원_병·의원 | 복지×보건, **기관이 다른 데이터** 교차. 경산은 복지 161 vs 병원 88 |
| 2 | 어린이보호구역 CCTV 설치율이 낮은 시군은? | 단일 | 경상북도_어린이보호구역 정보조회 | 포항 14%·영천 15% vs 상주 100%·경주 96% — 격차가 극적 |
| 3 | 시군별 공중화장실·사회적기업·마을기업 수를 한 표로 | sgg 3-way | 공중화장실 × 사회적기업 × 마을기업 | 세 테이블 3중 조인, 22개 시군 전부 매칭 |
| 4 | 구미시 읍면동별 경로당·어린이보호구역·음식점 수는? | emd 32/32 | 구미 경로당 × 어린이보호구역 × 일반음식점 | 고아읍 경로당 48·음식점 333 — 읍면동 단위 3중 조인 완전매칭 |
| 5 | 포항 읍면동별 생활인구 대비 대피소 수용률은? | emd 21 | 포항 지역별 생활인구 × 대피장소 목록 | 오천읍 4.4만 명에 수용 3.2% / 동해면 38% — 재난안전 정책 질문 |
| 6 | 영주시 읍면동별 태양광 허가 건수·용량 vs 공공건물 수 | emd 19/19 | 영주 태양광발전 허가 × 건물재산 | 문수면 83건 9,746kW — 에너지×재산 |
| 7 | 경북 시군별 밥상물가(쌀·돼지고기·배추…) 비교 | 단일 wide | 경상북도_밥상물가 정보조회 | 8품목×23시군 히트맵, 구미 배추 1,300 vs 경북평균 4,178 |
| 8 | 냉면·삼겹살 가격이 가장 비싼/싼 시군은? | 단일 wide | 경상북도_개인서비스요금 정보조회 | 13품목, 지도 색칠용 |
| 9 | 포항 월별 전입·전출 사유(직업/주택) 추이는? | 시간 조인 | 포항 전입 요건 × 전출 요건 | 2023-01~ 43개월 시계열, 주택 사유 급증 월 포착 |
| 10 | 영천시 읍면동별 체육시설·농어촌민박·착한가격업소 분포 | emd 39 | 영천 동네체육시설 × 농어촌민박 × 착한가격업소 | 화북면 민박 12 — 관광 인프라 |

## SQL

```sql
-- 1
with a as (select sgg(fcltAddr) s, count(*) welfare from t_15143795 group by 1),
     b as (select sgg(dutyAddr) s, count(*) hospitals from t_15000736_getHsptlBassInfoInqire
           where dutyAddr like '경상북도%' group by 1)
select a.s 시군, welfare 노인복지시설, hospitals 병의원 from a join b using(s) where a.s is not null order by 2 desc;

-- 2
select sgg(roadaddr) 시군, count(*) 보호구역,
       round(100.0*sum(case when cctvYN='Y' then 1 else 0 end)/count(*),1) cctv설치율
from t_15143780 where sgg(roadaddr) is not null group by 1 order by 2 desc;

-- 3
with t as (select sgg(roadaddr) s, count(*) toilets from t_15143265 group by 1),
     e as (select sgg(roadaddr) s, count(*) social  from t_15143756 group by 1),
     v as (select sgg(area)     s, count(*) village from t_15143263 group by 1)
select t.s 시군, toilets 공중화장실, social 사회적기업, village 마을기업
from t join e using(s) join v using(s) where t.s is not null order by 2 desc;

-- 4
with a as (select emd(lnm_adres) e, count(*) senior      from t_15097249 group by 1),
     b as (select emd(lnm_adres) e, count(*) childzone   from t_15097248 group by 1),
     c as (select emd(locplcrn)  e, count(*) restaurants from t_15097246 group by 1)
select a.e 읍면동, senior 경로당, childzone 어린이보호구역, restaurants 음식점
from a join b using(e) join c using(e) where a.e is not null order by 2 desc;

-- 5
with p as (select adstrd dong, max(try_cast(reside_popltn_co as double)) 거주,
                  max(try_cast(visit_popltn_co as double)) 방문
           from t_15139580 where date='202512' group by 1),
     s as (select emd(addr) e, count(*) 대피소, sum(try_cast(aceptnc_co as int)) 수용인원
           from t_15139564 group by 1)
select dong 읍면동, 거주, 방문, 대피소, 수용인원, round(100.0*수용인원/(거주+방문),1) 수용률
from p join s on s.e='포항시|'||dong order by 거주 desc;

-- 6
with s as (select emd(INSTL_PLACE) e, count(*) solar, round(sum(try_cast(PRMISN_CPCTY as double)),1) kw
           from t_15110920 group by 1),
     b as (select emd(LOCPLC) e, count(*) bldg from t_15110916 group by 1)
select s.e 읍면동, solar 태양광허가, kw 허가용량kW, bldg 공공건물 from s join b using(e)
where s.e is not null order by 2 desc;

-- 7
select itemName, averageGb 경북평균, averagePh 포항, averageGj 경주, averageAd 안동, averageGm 구미 from t_15143783;

-- 8
select itemName, averageGb 경북평균, averageAd 안동, averageGm 구미, averageGj 경주, averageKc 김천 from t_15143792;

-- 9
select i.year||'-'||i.mt ym, i.occp 전입_직업, i.house 전입_주택, o.job 전출_직업, o.house 전출_주택
from t_15139545 i join t_15139546 o on i.year=o.year and i.mt=o.mt order by 1;

-- 10
with a as (select emd(lotAddr)  e, count(*) sports from t_15157807 group by 1),
     b as (select emd(lotAddr)  e, count(*) stays  from t_15157838 group by 1),
     c as (select emd(roadAddr) e, count(*) cheap  from t_15157773 group by 1)
select a.e 읍면동, sports 체육시설, coalesce(stays,0) 농어촌민박, coalesce(cheap,0) 착한가격업소
from a left join b using(e) left join c using(e) where a.e is not null order by 2 desc;
```

주의: 포항 "지역별 주민등록 인구 현황"(15139557)은 읍면동 *코드*만 있고 이름이 없어 이름 기반 조인 불가 →
생활인구(15139580)를 대신 사용. 국립중앙의료원 병·의원은 20,000행 캡(`truncated`)이라 경북 외 지역은 일부만 들어있음.
