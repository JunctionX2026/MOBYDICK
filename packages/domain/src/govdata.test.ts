import { describe, expect, it } from "vitest";
import {
  applyGovDataRequestFilters,
  assessGovDataRunResult,
  deriveGovDataJoinCondition,
  deriveGovDataOutputColumns,
  parseGovDataOperationSpec,
  parseGovDataLiveCatalog,
  parseGovDataLiveResult,
  parseGovDataPlan,
  parseGovDataRecommendation,
  parseGovDataRunResult,
} from "./govdata";

const runResult = {
  columns: ["key"],
  rows: [["포항시"]],
  row_count: 1,
  null_rate: 0,
  sources: [{ alias: "a", dataset_id: "15143795", title: "노인복지시설" }],
  dropped_detail: [],
};

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

describe("deriveGovDataOutputColumns", () => {
  it("uses the joined key and metric names for a multi-source plan", () => {
    const parsed = parseGovDataOperationSpec({
      sources: [
        {
          alias: "a",
          dataset_id: "15143795",
          key: { column: "fcltAddr", level: "sgg" },
          filters: [],
          metrics: [{ name: "welfare", agg: "count", column: "*" }],
        },
        {
          alias: "b",
          dataset_id: "15143796",
          key: { column: "address", level: "sgg" },
          filters: [],
          metrics: [{ name: "clinics", agg: "count", column: "*" }],
        },
      ],
      join: "inner",
      order_by: [],
      limit: 50,
    });

    expect(parsed).not.toBeNull();
    expect(deriveGovDataOutputColumns(parsed!)).toEqual(["key", "welfare", "clinics"]);
  });

  it("uses raw columns when a source has no metrics", () => {
    const parsed = parseGovDataOperationSpec({
      sources: [{ alias: "a", dataset_id: "15143795", columns: ["name", "count"], filters: [] }],
      limit: 20,
    });

    expect(parsed).not.toBeNull();
    expect(deriveGovDataOutputColumns(parsed!)).toEqual(["name", "count"]);
  });
});

describe("deriveGovDataJoinCondition", () => {
  it("keeps the question-facing join method and source key mapping", () => {
    const parsed = parseGovDataOperationSpec({
      ...spec,
      sources: [
        ...spec.sources,
        {
          alias: "b",
          dataset_id: "15143796",
          key: { column: "address", level: "sgg" },
          filters: [],
          metrics: [{ name: "clinics", agg: "count", column: "*" }],
        },
      ],
    });

    expect(parsed).not.toBeNull();
    expect(deriveGovDataJoinCondition(parsed!)).toEqual({
      mode: "inner",
      levels: ["sgg"],
      sources: [
        { alias: "a", datasetId: "15143795", column: "fcltAddr", level: "sgg" },
        { alias: "b", datasetId: "15143796", column: "address", level: "sgg" },
      ],
    });
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
      parseGovDataLiveCatalog({
        services: [
          {
            service: "HEAT_SHELTER",
            name: "공공 무더위쉼터 정보",
            operations: [],
            required_params: [],
            format: { type: "JSON" },
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

    expect(
      parseGovDataLiveResult({
        service: "HEAT_SHELTER",
        operation: null,
        payload: { type: "JSON" },
        status_code: 200,
        content_type: "application/json",
        format: "json",
        response: { body: { items: [] } },
        records: [],
        record_count: 0,
        total_count: 0,
      }),
    ).not.toBeNull();
  });

  it("accepts a planner response with a pipeline and JSON output", () => {
    const plan = parseGovDataPlan({
      planner: "openai",
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
        links: [{ id: "link-1", source: "source-1", target: "output-1", intent: "질문 기준으로 조인·변환" }],
      },
      result: {
        columns: ["key", "welfare"],
        rows: [["포항시", 10]],
        row_count: 1,
        null_rate: 0,
        sources: [{ alias: "a", dataset_id: "15143795", title: "노인복지시설" }],
        dropped_detail: [],
        output: [{ region: "포항시", count: 10 }],
      },
    });

    expect(plan).not.toBeNull();
    expect(plan?.plannerError).toBe("optional diagnostic");
    expect(plan?.pipeline.links[0]?.intent).toBe("질문 기준으로 조인·변환");
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

describe("GovData result quality gates", () => {
  it("stops when a result drops below the previous stage retention threshold", () => {
    const result = parseGovDataRunResult({ ...runResult, row_count: 4 });

    expect(result == null ? null : assessGovDataRunResult(result, 10)?.reason).toBe("row_drop");
  });

  it("stops when the lowest join match rate is below the threshold", () => {
    const result = parseGovDataRunResult({
      ...runResult,
      dropped_detail: [
        {
          alias: "a",
          dataset_id: "15143795",
          title: "노인복지시설",
          keys: 10,
          matched: 4,
          match_rate: 0.4,
          dropped: 6,
          dropped_keys: ["없는 지역"],
          reason_code: "unmatched_normalized_key",
        },
      ],
    });

    expect(result == null ? null : assessGovDataRunResult(result)?.reason).toBe("match_rate");
  });

  it("allows partial resource coverage for a left join while retaining the null-rate gate", () => {
    const result = parseGovDataRunResult({
      ...runResult,
      dropped_detail: [
        {
          alias: "shelter",
          dataset_id: "15139564",
          title: "대피 장소 목록",
          keys: 43,
          matched: 21,
          match_rate: 0.488,
          dropped: 22,
          dropped_keys: ["없는 지역"],
          reason_code: "missing_normalized_key",
        },
      ],
    });

    expect(result == null ? null : assessGovDataRunResult(result, undefined, { allowPartialMatch: true })).toBeNull();
    expect(
      result == null
        ? null
        : assessGovDataRunResult({ ...result, nullRate: 0.21 }, undefined, { allowPartialMatch: true })?.reason,
    ).toBe("null_rate");
  });

  it("stops when the result null rate is too high", () => {
    const result = parseGovDataRunResult({ ...runResult, null_rate: 0.21 });

    expect(result == null ? null : assessGovDataRunResult(result)?.reason).toBe("null_rate");
  });
});

describe("GovData request filters", () => {
  it("filters hierarchical string keys and preserves aligned JSON output", () => {
    const result = applyGovDataRequestFilters(
      {
        columns: ["key", "total"],
        rows: [["포항시|송라면", 3], ["경주시|황성동", 4]],
        rowCount: 2,
        nullRate: 0,
        sources: [],
        droppedDetail: [],
        output: [{ region: "포항시|송라면", total: 3 }, { region: "경주시|황성동", total: 4 }],
      },
      { region: "포항시" },
      { type: "object", properties: { region: { column: "key" } } },
    );

    expect(result.rows).toEqual([["포항시|송라면", 3]]);
    expect(result.rowCount).toBe(1);
    expect(result.output).toEqual([{ region: "포항시|송라면", total: 3 }]);
  });

  it("rejects a filter that is not mapped to a result column", () => {
    const parsed = parseGovDataRunResult(runResult);

    expect(parsed).not.toBeNull();

    if (parsed == null) {
      return;
    }

    expect(() =>
      applyGovDataRequestFilters(
        parsed,
        { missing: "value" },
        { properties: { region: { column: "key" } } },
      ),
    ).toThrow("unknown request filter field");
  });
});
