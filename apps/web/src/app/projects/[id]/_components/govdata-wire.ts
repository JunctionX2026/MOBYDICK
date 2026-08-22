import type { GovDataOperationSpec } from "@mobydick/domain";

export function toGovDataOperationSpecWire(spec: GovDataOperationSpec) {
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
