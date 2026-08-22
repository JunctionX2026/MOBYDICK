import { describe, expect, it } from "vitest";
import {
  parseGovDataOperationSpec,
  parseGovDataLiveCatalog,
  parseGovDataLiveResult,
  parseGovDataPlan,
  parseGovDataRecommendation,
  parseGovDataRunResult,
} from "./govdata";

const spec = {
  sources: [
    {
      alias: "a",
      dataset_id: "15143795",
      key: { column: "fcltAddr", level: "sgg" },
      filters: [],
      metrics: [{ name: "welfare", agg: "count", column: "*" }],
    },
  ],
  join: "inner",
  order_by: [{ name: "welfare", desc: true }],
  limit: 50,
};

describe("parseGovDataOperationSpec", () => {
  it("accepts the bundle's declarative operation format", () => {
    expect(parseGovDataOperationSpec(spec)).toEqual({
      sources: [
        {
          alias: "a",
          datasetId: "15143795",
          key: { column: "fcltAddr", level: "sgg" },
          filters: [],
          metrics: [{ name: "welfare", aggregation: "count", column: "*" }],
          groupBy: [],
        },
      ],
      join: "inner",
      orderBy: [{ name: "welfare", descending: true }],
      limit: 50,
    });
  });

  it.each([
    ["missing sources", { limit: 10 }],
    ["invalid identifier", { ...spec, sources: [{ ...spec.sources[0], dataset_id: "t;drop" }] }],
    [
      "invalid group identifier",
      { ...spec, sources: [{ ...spec.sources[0], group_by: ["region;drop"] }] },
    ],
    ["executable aggregation", { ...spec, sources: [{ ...spec.sources[0], metrics: [{ name: "x", agg: "raw_sql", column: "*" }] }] }],
    ["unbounded limit", { ...spec, limit: 1001 }],
  ])("rejects %s", (_label, value) => {
    expect(parseGovDataOperationSpec(value)).toBeNull();
  });
});

describe("GovData response parsers", () => {
  it("accepts the live API catalog and response contract", () => {
    expect(
      parseGovDataLiveCatalog({
        services: [
          {
            service: "TAGO_STATION",
            name: "TAGO 버스 정류소 정보",
            endpoint: "https://apis.data.go.kr/1613000/BusSttnInfoInqireService",
            default_operation: "getCtyCodeList",
            operations: ["getCtyCodeList"],
            required_params: [],
            format: { _type: "json" },
          },
        ],
      }),
    ).not.toBeNull();

    expect(
      parseGovDataLiveResult({
        service: "TAGO_STATION",
        operation: "getCtyCodeList",
        endpoint: "https://apis.data.go.kr/1613000/BusSttnInfoInqireService/getCtyCodeList",
        payload: { _type: "json", pageNo: 1, numOfRows: 100 },
        status_code: 200,
        content_type: "application/json",
        format: "json",
        response: { response: { body: { items: { item: [{ citycode: "37000" }] } } } },
        records: [{ citycode: "37000" }],
        record_count: 1,
        total_count: 1,
      }),
    ).not.toBeNull();
  });

  it("accepts a planner response with a pipeline and JSON output", () => {
    const plan = parseGovDataPlan({
      planner: "codex",
      planner_error: "optional diagnostic",
      title: "시군별 시설 수",
      explanation: "검증된 데이터 소스를 조인했어요.",
      spec,
      pipeline: {
        nodes: [
          {
            id: "source-1",
            kind: "SOURCE",
            title: "노인복지시설",
            subtitle: "100행",
            dataset_id: "15143795",
            position: { x: 64, y: 64 },
          },
          {
            id: "output-1",
            kind: "OUTPUT",
            title: "JSON 결과",
            subtitle: "API · MCP 출력",
            dataset_id: null,
            position: { x: 336, y: 64 },
          },
        ],
        links: [{ id: "link-1", source: "source-1", target: "output-1" }],
      },
      result: {
        columns: ["key", "welfare"],
        rows: [["포항시", 10]],
        row_count: 1,
        sources: [{ alias: "a", dataset_id: "15143795", title: "노인복지시설" }],
        dropped_detail: [],
        output: [{ region: "포항시", count: 10 }],
      },
    });

    expect(plan).not.toBeNull();
    expect(plan?.plannerError).toBe("optional diagnostic");
  });

  it("rejects a run response with a missing dropped-detail field", () => {
    expect(parseGovDataRunResult({ columns: ["key"], rows: [], row_count: 0, sources: [] })).toBeNull();
  });

  it("rejects a recommendation when a suggested spec is malformed", () => {
    expect(
      parseGovDataRecommendation({
        query: "질문",
        parts: [],
        mode: "single",
        weak_match: false,
        datasets: [],
        joinable_sets: [],
        single_spec: { sources: [] },
        llm_planning: false,
      }),
    ).toBeNull();
  });
});
