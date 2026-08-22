export type GovDataConfidence = "high" | "medium" | "low";
export type GovDataJoinLevel = "sgg" | "emd" | "raw";
export type GovDataFilterOperator = "=" | "!=" | ">" | "<" | ">=" | "<=" | "like" | "in";
export type GovDataMetricAggregation =
  | "count"
  | "sum"
  | "avg"
  | "min"
  | "max"
  | "count_distinct"
  | "count_if";

export interface GovDataColumn {
  name: string;
  role: string;
  description: string;
  nullRate: number;
  samples: string[];
}

export interface GovDataDataset {
  datasetId: string;
  title: string;
  operation: string;
  category: string;
  provider: string;
  rows: number;
  updateCycle: string;
  reference: string;
  regionKeys: Record<string, string>;
  timeColumns: string[];
  numericColumns: string[];
  columnCount: number;
  joinableCount: number;
  score?: number;
  cosine?: number;
  bm25?: number;
  confidence?: GovDataConfidence;
  matchedColumn: string | null;
}

export interface GovDataNeighbor {
  otherDatasetId: string;
  level: GovDataJoinLevel;
  sourceColumn: string;
  targetColumn: string;
  matched: number;
  matchRate: number;
  title: string;
  category: string;
  provider: string;
  rows: number;
  levelLabel: string;
}

export interface GovDataDatasetWiki extends GovDataDataset {
  description: string;
  keywords: string[];
  apiUrl: string;
  columns: GovDataColumn[];
  neighbors: GovDataNeighbor[];
}

export interface GovDataFilter {
  column: string;
  operator: GovDataFilterOperator;
  value: string | number | string[];
}

export interface GovDataMetric {
  name: string;
  aggregation: GovDataMetricAggregation;
  column: string;
  value?: string;
}

export interface GovDataSourceSpec {
  alias: string;
  datasetId: string;
  key?: { column: string; level: GovDataJoinLevel };
  filters: GovDataFilter[];
  metrics: GovDataMetric[];
  columns?: string[];
  groupBy: string[];
}

export interface GovDataOrderBy {
  name: string;
  descending: boolean;
}

export interface GovDataOperationSpec {
  sources: GovDataSourceSpec[];
  join?: "inner" | "left";
  orderBy: GovDataOrderBy[];
  limit: number;
}

export interface GovDataJoinLink {
  sourceDatasetId: string;
  targetDatasetId: string;
  sourceColumn: string;
  targetColumn: string;
  matchRate: number;
  matched: number;
}

export interface GovDataJoinableSet {
  level: GovDataJoinLevel;
  levelLabel: string;
  members: string[];
  titles: string[];
  minimumMatchRate: number;
  links: GovDataJoinLink[];
  spec: GovDataOperationSpec;
}

export interface GovDataRecommendation {
  query: string;
  parts: string[];
  mode: "join" | "single";
  weakMatch: boolean;
  datasets: GovDataDataset[];
  joinableSets: GovDataJoinableSet[];
  singleSpec: GovDataOperationSpec | null;
  llmPlanning: boolean;
}

export interface GovDataDropDetail {
  alias: string;
  datasetId: string;
  title: string;
  keys: number;
  matched: number;
  matchRate: number;
  dropped: number;
  droppedKeys: string[];
}

export interface GovDataRunResult {
  columns: string[];
  rows: unknown[][];
  rowCount: number;
  sources: Array<{ alias: string; datasetId: string; title: string }>;
  droppedDetail: GovDataDropDetail[];
  output?: unknown;
}

export type GovDataPipelineNodeKind = "SOURCE" | "TRANSFORM" | "JOIN" | "OUTPUT";

export interface GovDataPipelineNode {
  id: string;
  kind: GovDataPipelineNodeKind;
  title: string;
  subtitle: string | null;
  datasetId: string | null;
  position: { x: number; y: number };
}

export interface GovDataPipeline {
  nodes: GovDataPipelineNode[];
  links: Array<{ id: string; source: string; target: string }>;
}

export interface GovDataPlan {
  planner: "codex" | "fallback";
  plannerError?: string;
  title: string;
  explanation: string;
  spec: GovDataOperationSpec;
  result: GovDataRunResult;
  pipeline: GovDataPipeline;
}

export interface GovDataStats {
  datasets: number;
  columns: number;
  rows: number;
  joinablePairs: number;
  withRegionKey: number;
  llmPlanning: boolean;
}

export interface GovDataLiveService {
  service: string;
  name: string;
  endpoint: string;
  defaultOperation: string | null;
  operations: string[];
  requiredParams: string[];
  format: Record<string, string>;
}

export interface GovDataLiveCatalog {
  services: GovDataLiveService[];
}

export interface GovDataLiveResult {
  service: string;
  operation: string | null;
  endpoint: string;
  payload: Record<string, unknown>;
  statusCode: number;
  contentType: string;
  format: "json" | "xml";
  response: unknown;
  records: Array<Record<string, unknown>>;
  recordCount: number;
  totalCount: number | null;
}

type RecordValue = Record<string, unknown>;

function isRecord(value: unknown): value is RecordValue {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function nonEmptyString(value: unknown): string | null {
  const string = stringValue(value)?.trim();
  return string == null || string === "" ? null : string;
}

function identifierString(value: unknown): string | null {
  const string = nonEmptyString(value);
  return string != null && /^[0-9A-Za-z가-힣_]+$/.test(string) ? string : null;
}

function finiteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function nonNegativeNumber(value: unknown): number | null {
  const number = finiteNumber(value);
  return number == null || number < 0 ? null : number;
}

function booleanValue(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function stringArray(value: unknown): string[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const output: string[] = [];

  for (const item of value) {
    const string = nonEmptyString(item);

    if (string == null) {
      return null;
    }

    output.push(string);
  }

  return output;
}

function identifierArray(value: unknown): string[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const output: string[] = [];

  for (const item of value) {
    const identifier = identifierString(item);

    if (identifier == null) {
      return null;
    }

    output.push(identifier);
  }

  return output;
}

function stringRecord(value: unknown): Record<string, string> | null {
  if (!isRecord(value)) {
    return null;
  }

  const output: Record<string, string> = {};

  for (const [key, item] of Object.entries(value)) {
    if (item == null || item === "") {
      continue;
    }

    const string = nonEmptyString(item);

    if (string == null) {
      return null;
    }

    output[key] = string;
  }

  return output;
}

function unknownRecord(value: unknown): Record<string, unknown> | null {
  return isRecord(value) ? value : null;
}

function oneOf<T extends string>(value: unknown, values: readonly T[]): T | null {
  if (typeof value !== "string") {
    return null;
  }

  return values.find((item) => item === value) ?? null;
}

const JOIN_LEVELS = ["sgg", "emd", "raw"] as const;
const FILTER_OPERATORS = ["=", "!=", ">", "<", ">=", "<=", "like", "in"] as const;
const AGGREGATIONS = [
  "count",
  "sum",
  "avg",
  "min",
  "max",
  "count_distinct",
  "count_if",
] as const;

function parseDataset(value: unknown): GovDataDataset | null {
  if (!isRecord(value)) {
    return null;
  }

  const datasetId = identifierString(value.dataset_id);
  const title = nonEmptyString(value.title);
  const operation = nonEmptyString(value.op);
  const category = nonEmptyString(value.category);
  const provider = nonEmptyString(value.provider);
  const rows = nonNegativeNumber(value.rows);
  const updateCycle = stringValue(value.update_cycle);
  const reference = stringValue(value.reference);
  const regionKeys = stringRecord(value.region_keys);
  const timeColumns = stringArray(value.time_columns);
  const numericColumns = stringArray(value.numeric_columns);
  const columnCount = nonNegativeNumber(value.n_columns);
  const joinableCount = nonNegativeNumber(value.joinable_count);

  if (
    datasetId == null ||
    title == null ||
    operation == null ||
    category == null ||
    provider == null ||
    rows == null ||
    updateCycle == null ||
    reference == null ||
    regionKeys == null ||
    timeColumns == null ||
    numericColumns == null ||
    columnCount == null ||
    joinableCount == null
  ) {
    return null;
  }

  const score = value.score == null ? undefined : finiteNumber(value.score);
  const cosine = value.cosine == null ? undefined : finiteNumber(value.cosine);
  const bm25 = value.bm25 == null ? undefined : finiteNumber(value.bm25);
  const confidence = value.confidence == null ? undefined : oneOf(value.confidence, ["high", "medium", "low"] as const);
  const matchedColumn = value.matched_column == null ? null : nonEmptyString(value.matched_column);

  if (
    (value.score != null && score == null) ||
    (value.cosine != null && cosine == null) ||
    (value.bm25 != null && bm25 == null) ||
    (value.confidence != null && confidence == null) ||
    (value.matched_column != null && matchedColumn == null)
  ) {
    return null;
  }

  return {
    datasetId,
    title,
    operation,
    category,
    provider,
    rows,
    updateCycle,
    reference,
    regionKeys,
    timeColumns,
    numericColumns,
    columnCount,
    joinableCount,
    matchedColumn,
    ...(score == null ? {} : { score }),
    ...(cosine == null ? {} : { cosine }),
    ...(bm25 == null ? {} : { bm25 }),
    ...(confidence == null ? {} : { confidence }),
  };
}

function parseColumn(value: unknown): GovDataColumn | null {
  if (!isRecord(value)) {
    return null;
  }

  const name = nonEmptyString(value.name);
  const role = nonEmptyString(value.role);
  const description = stringValue(value.desc_ko);
  const nullRate = nonNegativeNumber(value.null_rate);
  const samples = stringArray(value.samples);

  return name == null || role == null || description == null || nullRate == null || samples == null
    ? null
    : { name, role, description, nullRate, samples };
}

function parseNeighbor(value: unknown): GovDataNeighbor | null {
  if (!isRecord(value)) {
    return null;
  }

  const otherDatasetId = nonEmptyString(value.other);
  const level = oneOf(value.level, JOIN_LEVELS);
  const sourceColumn = nonEmptyString(value.my_col);
  const targetColumn = nonEmptyString(value.other_col);
  const matched = nonNegativeNumber(value.matched);
  const matchRate = finiteNumber(value.match_rate);
  const title = nonEmptyString(value.title);
  const category = nonEmptyString(value.category);
  const provider = nonEmptyString(value.provider);
  const rows = nonNegativeNumber(value.rows);
  const levelLabel = nonEmptyString(value.level_label);

  if (
    otherDatasetId == null ||
    level == null ||
    sourceColumn == null ||
    targetColumn == null ||
    matched == null ||
    matchRate == null ||
    title == null ||
    category == null ||
    provider == null ||
    rows == null ||
    levelLabel == null
  ) {
    return null;
  }

  return { otherDatasetId, level, sourceColumn, targetColumn, matched, matchRate, title, category, provider, rows, levelLabel };
}

function parseWiki(value: unknown): GovDataDatasetWiki | null {
  if (!isRecord(value)) {
    return null;
  }

  const dataset = parseDataset(value);
  const description = stringValue(value.description);
  const keywords = stringArray(value.keywords);
  const apiUrl = stringValue(value.api_url);
  const columns = Array.isArray(value.columns) ? value.columns.map(parseColumn) : null;
  const neighbors = Array.isArray(value.neighbors) ? value.neighbors.map(parseNeighbor) : null;

  if (
    dataset == null ||
    description == null ||
    keywords == null ||
    apiUrl == null ||
    columns == null ||
    !columns.every((column): column is GovDataColumn => column != null) ||
    neighbors == null ||
    !neighbors.every((neighbor): neighbor is GovDataNeighbor => neighbor != null)
  ) {
    return null;
  }

  return { ...dataset, description, keywords, apiUrl, columns, neighbors };
}

function parseKey(value: unknown): { column: string; level: GovDataJoinLevel } | null {
  if (!isRecord(value)) {
    return null;
  }

  const column = identifierString(value.column);
  const level = oneOf(value.level, JOIN_LEVELS);

  return column == null || level == null ? null : { column, level };
}

function parseFilter(value: unknown): GovDataFilter | null {
  if (!isRecord(value)) {
    return null;
  }

  const column = identifierString(value.column);
  const operator = oneOf(value.op, FILTER_OPERATORS);
  const rawValue = value.value;
  let filterValue: string | number | string[] | null = null;

  if (typeof rawValue === "string" || typeof rawValue === "number") {
    filterValue = rawValue;
  } else {
    filterValue = stringArray(rawValue);
  }

  return column == null || operator == null || filterValue == null
    ? null
    : { column, operator, value: filterValue };
}

function parseMetric(value: unknown): GovDataMetric | null {
  if (!isRecord(value)) {
    return null;
  }

  const name = identifierString(value.name);
  const aggregation = oneOf(value.agg, AGGREGATIONS);
  const column = value.column === "*" ? "*" : identifierString(value.column);
  const metricValue = value.value == null ? undefined : nonEmptyString(value.value);

  if (name == null || aggregation == null || column == null || (value.value != null && metricValue == null)) {
    return null;
  }

  return { name, aggregation, column, ...(metricValue == null ? {} : { value: metricValue }) };
}

function parseSourceSpec(value: unknown): GovDataSourceSpec | null {
  if (!isRecord(value)) {
    return null;
  }

  const alias = identifierString(value.alias);
  const datasetId = identifierString(value.dataset_id);
  const filters = value.filters == null ? [] : Array.isArray(value.filters) ? value.filters.map(parseFilter) : null;
  const metrics = value.metrics == null ? [] : Array.isArray(value.metrics) ? value.metrics.map(parseMetric) : null;
  const columns = value.columns == null ? undefined : identifierArray(value.columns);
  const groupBy = value.group_by == null ? [] : identifierArray(value.group_by);
  const key = value.key == null ? undefined : parseKey(value.key);

  if (
    alias == null ||
    datasetId == null ||
    filters == null ||
    !filters.every((filter): filter is GovDataFilter => filter != null) ||
    metrics == null ||
    !metrics.every((metric): metric is GovDataMetric => metric != null) ||
    (value.columns != null && columns == null) ||
    groupBy == null ||
    (value.key != null && key == null)
  ) {
    return null;
  }

  return {
    alias,
    datasetId,
    ...(key == null ? {} : { key }),
    filters,
    metrics,
    ...(columns == null ? {} : { columns }),
    groupBy,
  };
}

function parseOrderBy(value: unknown): GovDataOrderBy | null {
  if (!isRecord(value)) {
    return null;
  }

  const name = identifierString(value.name);
  const descending = booleanValue(value.desc);

  return name == null || descending == null ? null : { name, descending };
}

export function parseGovDataOperationSpec(value: unknown): GovDataOperationSpec | null {
  if (!isRecord(value) || !Array.isArray(value.sources)) {
    return null;
  }

  const sources = value.sources.map(parseSourceSpec);
  const join = value.join == null ? undefined : oneOf(value.join, ["inner", "left"] as const);
  const orderBy =
    value.order_by == null
      ? []
      : Array.isArray(value.order_by)
        ? value.order_by.map(parseOrderBy)
        : null;
  const limit = value.limit == null ? 100 : value.limit;

  if (
    sources.length === 0 ||
    !sources.every((source): source is GovDataSourceSpec => source != null) ||
    (value.join != null && join == null) ||
    orderBy == null ||
    !orderBy.every((order): order is GovDataOrderBy => order != null) ||
    typeof limit !== "number" ||
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > 1000
  ) {
    return null;
  }

  return { sources, ...(join == null ? {} : { join }), orderBy, limit };
}

export function serializeGovDataOperationSpec(spec: GovDataOperationSpec) {
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

function parseJoinLink(value: unknown): GovDataJoinLink | null {
  if (!isRecord(value)) {
    return null;
  }

  const sourceDatasetId = identifierString(value.a);
  const targetDatasetId = identifierString(value.b);
  const sourceColumn = identifierString(value.a_col);
  const targetColumn = identifierString(value.b_col);
  const matchRate = finiteNumber(value.match_rate);
  const matched = nonNegativeNumber(value.matched);

  if (
    sourceDatasetId == null ||
    targetDatasetId == null ||
    sourceColumn == null ||
    targetColumn == null ||
    matchRate == null ||
    matched == null
  ) {
    return null;
  }

  return { sourceDatasetId, targetDatasetId, sourceColumn, targetColumn, matchRate, matched };
}

function parseJoinableSet(value: unknown): GovDataJoinableSet | null {
  if (!isRecord(value)) {
    return null;
  }

  const level = oneOf(value.level, JOIN_LEVELS);
  const levelLabel = nonEmptyString(value.level_label);
  const members = stringArray(value.members);
  const titles = stringArray(value.titles);
  const minimumMatchRate = finiteNumber(value.min_match_rate);
  const links = Array.isArray(value.links) ? value.links.map(parseJoinLink) : null;
  const spec = parseGovDataOperationSpec(value.spec);

  if (
    level == null ||
    levelLabel == null ||
    members == null ||
    titles == null ||
    minimumMatchRate == null ||
    links == null ||
    !links.every((link): link is GovDataJoinLink => link != null) ||
    spec == null
  ) {
    return null;
  }

  return { level, levelLabel, members, titles, minimumMatchRate, links, spec };
}

export function parseGovDataRecommendation(value: unknown): GovDataRecommendation | null {
  if (!isRecord(value)) {
    return null;
  }

  const query = nonEmptyString(value.query);
  const parts = stringArray(value.parts);
  const mode = oneOf(value.mode, ["join", "single"] as const);
  const weakMatch = booleanValue(value.weak_match);
  const datasets = Array.isArray(value.datasets) ? value.datasets.map(parseDataset) : null;
  const joinableSets = Array.isArray(value.joinable_sets) ? value.joinable_sets.map(parseJoinableSet) : null;
  const singleSpec = value.single_spec == null ? null : parseGovDataOperationSpec(value.single_spec);
  const llmPlanning = booleanValue(value.llm_planning);

  if (
    query == null ||
    parts == null ||
    mode == null ||
    weakMatch == null ||
    datasets == null ||
    !datasets.every((dataset): dataset is GovDataDataset => dataset != null) ||
    joinableSets == null ||
    !joinableSets.every((set): set is GovDataJoinableSet => set != null) ||
    (value.single_spec != null && singleSpec == null) ||
    llmPlanning == null
  ) {
    return null;
  }

  return { query, parts, mode, weakMatch, datasets, joinableSets, singleSpec, llmPlanning };
}

function parseDropDetail(value: unknown): GovDataDropDetail | null {
  if (!isRecord(value)) {
    return null;
  }

  const alias = nonEmptyString(value.alias);
  const datasetId = nonEmptyString(value.dataset_id);
  const title = nonEmptyString(value.title);
  const keys = nonNegativeNumber(value.keys);
  const matched = nonNegativeNumber(value.matched);
  const matchRate = finiteNumber(value.match_rate);
  const dropped = nonNegativeNumber(value.dropped);
  const droppedKeys = stringArray(value.dropped_keys);

  if (
    alias == null ||
    datasetId == null ||
    title == null ||
    keys == null ||
    matched == null ||
    matchRate == null ||
    dropped == null ||
    droppedKeys == null
  ) {
    return null;
  }

  return { alias, datasetId, title, keys, matched, matchRate, dropped, droppedKeys };
}

export function parseGovDataRunResult(value: unknown): GovDataRunResult | null {
  if (!isRecord(value)) {
    return null;
  }

  const columns = stringArray(value.columns);
  const rows = Array.isArray(value.rows) ? value.rows.map((row) => (Array.isArray(row) ? row : null)) : null;
  const rowCount = nonNegativeNumber(value.row_count);
  const sources = Array.isArray(value.sources)
    ? value.sources.map((source) => {
        if (!isRecord(source)) {
          return null;
        }

        const alias = nonEmptyString(source.alias);
        const datasetId = nonEmptyString(source.dataset_id);
        const title = nonEmptyString(source.title);

        return alias == null || datasetId == null || title == null ? null : { alias, datasetId, title };
      })
    : null;
  const droppedDetail = Array.isArray(value.dropped_detail) ? value.dropped_detail.map(parseDropDetail) : null;

  if (
    columns == null ||
    rows == null ||
    !rows.every((row): row is unknown[] => row != null) ||
    rowCount == null ||
    sources == null ||
    !sources.every((source): source is GovDataRunResult["sources"][number] => source != null) ||
    droppedDetail == null ||
    !droppedDetail.every((detail): detail is GovDataDropDetail => detail != null)
  ) {
    return null;
  }

  return { columns, rows, rowCount, sources, droppedDetail, ...(value.output == null ? {} : { output: value.output }) };
}

function parsePipelineNode(value: unknown): GovDataPipelineNode | null {
  if (!isRecord(value)) {
    return null;
  }

  const id = nonEmptyString(value.id);
  const kind = oneOf(value.kind, ["SOURCE", "TRANSFORM", "JOIN", "OUTPUT"] as const);
  const title = nonEmptyString(value.title);
  const subtitle = value.subtitle == null ? null : nonEmptyString(value.subtitle);
  const datasetId = value.dataset_id == null ? null : identifierString(value.dataset_id);
  const positionValue = isRecord(value.position) ? value.position : null;
  const x = positionValue == null ? null : finiteNumber(positionValue.x);
  const y = positionValue == null ? null : finiteNumber(positionValue.y);
  const position = x == null || y == null ? null : { x, y };

  if (
    id == null ||
    kind == null ||
    title == null ||
    (value.subtitle != null && subtitle == null) ||
    (value.dataset_id != null && datasetId == null) ||
    position == null
  ) {
    return null;
  }

  return { id, kind, title, subtitle, datasetId, position };
}

function parsePipelineLink(value: unknown) {
  if (!isRecord(value)) {
    return null;
  }

  const id = nonEmptyString(value.id);
  const source = nonEmptyString(value.source);
  const target = nonEmptyString(value.target);

  return id == null || source == null || target == null ? null : { id, source, target };
}

export function parseGovDataPlan(value: unknown): GovDataPlan | null {
  if (!isRecord(value)) {
    return null;
  }

  const planner = oneOf(value.planner, ["codex", "fallback"] as const);
  const plannerError = value.planner_error == null ? undefined : nonEmptyString(value.planner_error);
  const title = nonEmptyString(value.title);
  const explanation = nonEmptyString(value.explanation);
  const spec = parseGovDataOperationSpec(value.spec);
  const result = parseGovDataRunResult(value.result);
  const pipelineValue = isRecord(value.pipeline) ? value.pipeline : null;
  const nodes = pipelineValue != null && Array.isArray(pipelineValue.nodes) ? pipelineValue.nodes.map(parsePipelineNode) : null;
  const links = pipelineValue != null && Array.isArray(pipelineValue.links) ? pipelineValue.links.map(parsePipelineLink) : null;

  if (
    planner == null ||
    (value.planner_error != null && plannerError == null) ||
    title == null ||
    explanation == null ||
    spec == null ||
    result == null ||
    nodes == null ||
    !nodes.every((node): node is GovDataPipelineNode => node != null) ||
    links == null ||
    !links.every((link): link is GovDataPipeline["links"][number] => link != null)
  ) {
    return null;
  }

  const nodeIds = new Set(nodes.map((node) => node.id));

  if (links.some((link) => !nodeIds.has(link.source) || !nodeIds.has(link.target))) {
    return null;
  }

  return {
    planner,
    ...(plannerError == null ? {} : { plannerError }),
    title,
    explanation,
    spec,
    result,
    pipeline: { nodes, links },
  };
}

export function parseGovDataDatasetWiki(value: unknown): GovDataDatasetWiki | null {
  return parseWiki(value);
}

export function parseGovDataStats(value: unknown): GovDataStats | null {
  if (!isRecord(value)) {
    return null;
  }

  const datasets = nonNegativeNumber(value.datasets);
  const columns = nonNegativeNumber(value.columns);
  const rows = nonNegativeNumber(value.rows);
  const joinablePairs = nonNegativeNumber(value.joinable_pairs);
  const withRegionKey = nonNegativeNumber(value.with_region_key);
  const llmPlanning = booleanValue(value.llm_planning);

  return datasets == null ||
    columns == null ||
    rows == null ||
    joinablePairs == null ||
    withRegionKey == null ||
    llmPlanning == null
    ? null
    : { datasets, columns, rows, joinablePairs, withRegionKey, llmPlanning };
}

function parseGovDataLiveService(value: unknown): GovDataLiveService | null {
  if (!isRecord(value)) {
    return null;
  }

  const service = identifierString(value.service);
  const name = nonEmptyString(value.name);
  const endpoint = nonEmptyString(value.endpoint);
  const defaultOperation = value.default_operation == null ? null : identifierString(value.default_operation);
  const operations = identifierArray(value.operations);
  const requiredParams = identifierArray(value.required_params);
  const format = stringRecord(value.format);

  if (
    service == null ||
    name == null ||
    endpoint == null ||
    (value.default_operation != null && defaultOperation == null) ||
    operations == null ||
    requiredParams == null ||
    format == null
  ) {
    return null;
  }

  return { service, name, endpoint, defaultOperation, operations, requiredParams, format };
}

export function parseGovDataLiveCatalog(value: unknown): GovDataLiveCatalog | null {
  if (!isRecord(value) || !Array.isArray(value.services)) {
    return null;
  }

  const services = value.services.map(parseGovDataLiveService);

  return services.every((service): service is GovDataLiveService => service != null) ? { services } : null;
}

export function parseGovDataLiveResult(value: unknown): GovDataLiveResult | null {
  if (!isRecord(value)) {
    return null;
  }

  const service = identifierString(value.service);
  const operation = value.operation == null ? null : identifierString(value.operation);
  const endpoint = nonEmptyString(value.endpoint);
  const payload = unknownRecord(value.payload);
  const statusCode = value.status_code;
  const contentType = stringValue(value.content_type);
  const format = oneOf(value.format, ["json", "xml"] as const);
  const response = value.response;
  const records = Array.isArray(value.records) ? value.records.map(unknownRecord) : null;
  const recordCount = value.record_count;
  const totalCount = value.total_count == null ? null : value.total_count;

  if (
    service == null ||
    (value.operation != null && operation == null) ||
    endpoint == null ||
    payload == null ||
    typeof statusCode !== "number" ||
    !Number.isInteger(statusCode) ||
    statusCode < 100 ||
    contentType == null ||
    format == null ||
    !Array.isArray(records) ||
    !records.every((record): record is Record<string, unknown> => record != null) ||
    typeof recordCount !== "number" ||
    !Number.isInteger(recordCount) ||
    recordCount < 0 ||
    typeof totalCount !== "number" && totalCount !== null ||
    (typeof totalCount === "number" && (!Number.isInteger(totalCount) || totalCount < 0))
  ) {
    return null;
  }

  return {
    service,
    operation,
    endpoint,
    payload,
    statusCode,
    contentType,
    format,
    response,
    records,
    recordCount,
    totalCount,
  };
}
