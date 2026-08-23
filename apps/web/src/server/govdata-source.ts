import {
  parseGovDataDatasetWiki,
  parseGovDataLiveCatalog,
  parseGovDataLiveResult,
  parseGovDataPlan,
  parseGovDataRecommendation,
  parseGovDataRunResult,
  parseGovDataStats,
  type GovDataDatasetWiki,
  type GovDataLiveCatalog,
  type GovDataLiveResult,
  type GovDataOperationSpec,
  type GovDataPlan,
  type GovDataRecommendation,
  type GovDataRunResult,
  type GovDataStats,
} from "@mobydick/domain";

const DEFAULT_SOURCE_URL = "http://127.0.0.1:8000";

export class GovDataSourceError extends Error {
  readonly status: number;

  constructor(message: string, status = 502) {
    super(message);
    this.name = "GovDataSourceError";
    this.status = status;
  }
}

function sourceUrl() {
  return (process.env.GOVDATA_SOURCE_URL ?? DEFAULT_SOURCE_URL).replace(/\/+$/, "");
}

async function request(path: string, init?: RequestInit): Promise<unknown> {
  let response: Response;

  try {
    response = await fetch(`${sourceUrl()}${path}`, { ...init, cache: "no-store" });
  } catch {
    throw new GovDataSourceError(
      "GovData Studio에 연결할 수 없어요. FastAPI 서버를 127.0.0.1:8000에서 실행했는지 확인하세요.",
    );
  }

  const text = await response.text();
  let payload: unknown = null;

  try {
    payload = JSON.parse(text);
  } catch {
    throw new GovDataSourceError("GovData Studio가 JSON 응답을 주지 않았어요.");
  }

  if (!response.ok) {
    const detail =
      typeof payload === "object" && payload !== null && "detail" in payload && typeof payload.detail === "string"
        ? payload.detail
        : `GovData Studio 요청이 실패했어요. (${response.status})`;
    throw new GovDataSourceError(detail, response.status >= 500 ? 502 : 400);
  }

  return payload;
}

function externalOperationSpec(spec: GovDataOperationSpec) {
  return {
    sources: spec.sources.map((source) => ({
      alias: source.alias,
      dataset_id: source.datasetId,
      ...(source.key == null ? {} : { key: source.key }),
      filters: source.filters.map((filter) => ({
        column: filter.column,
        op: filter.operator,
        value: filter.value,
      })),
      metrics: source.metrics.map((metric) => ({
        name: metric.name,
        agg: metric.aggregation,
        column: metric.column,
        ...(metric.value == null ? {} : { value: metric.value }),
      })),
      ...(source.columns == null ? {} : { columns: source.columns }),
      group_by: source.groupBy,
    })),
    ...(spec.join == null ? {} : { join: spec.join }),
    order_by: spec.orderBy.map((order) => ({ name: order.name, desc: order.descending })),
    limit: spec.limit,
  };
}

export function serializeGovDataRunResult(result: GovDataRunResult) {
  return {
    columns: result.columns,
    rows: result.rows,
    row_count: result.rowCount,
    null_rate: result.nullRate,
    sources: result.sources.map((source) => ({
      alias: source.alias,
      dataset_id: source.datasetId,
      title: source.title,
    })),
    dropped_detail: result.droppedDetail.map((detail) => ({
      alias: detail.alias,
      dataset_id: detail.datasetId,
      title: detail.title,
      keys: detail.keys,
      matched: detail.matched,
      match_rate: detail.matchRate,
      dropped: detail.dropped,
      dropped_keys: detail.droppedKeys,
      reason_code: detail.reasonCode,
    })),
    ...(result.output == null ? {} : { output: result.output }),
  };
}

function externalPlan(plan: GovDataPlan) {
  return {
    planner: plan.planner,
    ...(plan.plannerError == null ? {} : { planner_error: plan.plannerError }),
    title: plan.title,
    explanation: plan.explanation,
    spec: externalOperationSpec(plan.spec),
    result: serializeGovDataRunResult(plan.result),
    pipeline: {
      nodes: plan.pipeline.nodes.map((node) => ({
        id: node.id,
        kind: node.kind,
        title: node.title,
        subtitle: node.subtitle,
        dataset_id: node.datasetId,
        position: node.position,
      })),
      links: plan.pipeline.links.map((link) => ({
        id: link.id,
        source: link.source,
        target: link.target,
        intent: link.intent,
      })),
    },
  };
}

export async function recommendGovData(query: string, k = 8): Promise<GovDataRecommendation> {
  const payload = await request("/api/recommend", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ query, k }),
  });
  const recommendation = parseGovDataRecommendation(payload);

  if (recommendation == null) {
    throw new GovDataSourceError("GovData Studio 추천 응답이 데이터 계약과 맞지 않아요.");
  }

  return recommendation;
}

export async function runGovData(
  spec: GovDataOperationSpec,
  schema?: Record<string, unknown>,
): Promise<GovDataRunResult> {
  const payload = await request("/api/run", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ spec: externalOperationSpec(spec), ...(schema == null ? {} : { schema }) }),
  });
  const result = parseGovDataRunResult(payload);

  if (result == null) {
    throw new GovDataSourceError("GovData Studio 실행 응답이 데이터 계약과 맞지 않아요.");
  }

  return result;
}

export async function planGovData(
  query: string,
  schema?: Record<string, unknown>,
): Promise<GovDataPlan> {
  const payload = await request("/api/plan", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ query, ...(schema == null ? {} : { schema }) }),
  });
  const plan = parseGovDataPlan(payload);

  if (plan == null) {
    throw new GovDataSourceError("GovData Studio 계획 응답이 데이터 계약과 맞지 않아요.");
  }

  return plan;
}

export function serializeGovDataPlan(plan: GovDataPlan) {
  return externalPlan(plan);
}

export async function getGovDataDataset(datasetId: string): Promise<GovDataDatasetWiki> {
  const payload = await request(`/api/dataset/${encodeURIComponent(datasetId)}`);
  const dataset = parseGovDataDatasetWiki(payload);

  if (dataset == null) {
    throw new GovDataSourceError("GovData Studio 데이터셋 응답이 데이터 계약과 맞지 않아요.");
  }

  return dataset;
}

export async function getGovDataStats(): Promise<GovDataStats> {
  const payload = await request("/api/stats");
  const stats = parseGovDataStats(payload);

  if (stats == null) {
    throw new GovDataSourceError("GovData Studio 통계 응답이 데이터 계약과 맞지 않아요.");
  }

  return stats;
}

export async function getGovDataLiveCatalog(): Promise<GovDataLiveCatalog> {
  const payload = await request("/api/live/catalog");
  const catalog = parseGovDataLiveCatalog(payload);

  if (catalog == null) {
    throw new GovDataSourceError("공공데이터 실시간 API 카탈로그가 데이터 계약과 맞지 않아요.");
  }

  return catalog;
}

export function serializeGovDataLiveCatalog(catalog: GovDataLiveCatalog) {
  return {
    services: catalog.services.map((service) => ({
      service: service.service,
      name: service.name,
      default_operation: service.defaultOperation,
      operations: service.operations,
      required_params: service.requiredParams,
      format: service.format,
    })),
  };
}

export async function executeGovDataLive(
  service: string,
  operation: string | undefined,
  payload: Record<string, unknown>,
): Promise<GovDataLiveResult> {
  const response = await request("/api/live/execute", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ service, ...(operation == null ? {} : { operation }), payload }),
  });
  const result = parseGovDataLiveResult(response);

  if (result == null) {
    throw new GovDataSourceError("공공데이터 실시간 API 응답이 데이터 계약과 맞지 않아요.");
  }

  return result;
}

export function serializeGovDataLiveResult(result: GovDataLiveResult) {
  return {
    service: result.service,
    operation: result.operation,
    payload: result.payload,
    status_code: result.statusCode,
    content_type: result.contentType,
    format: result.format,
    response: result.response,
    records: result.records,
    record_count: result.recordCount,
    total_count: result.totalCount,
  };
}
