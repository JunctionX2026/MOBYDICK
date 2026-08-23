import { applyGovDataRequestFilters, assessGovDataRunResult, type GovDataStopSignal, type Project } from "@mobydick/domain";
import { match } from "ts-pattern";
import { GovDataSourceError, runGovData, serializeGovDataRunResult } from "./govdata-source";
import { resolvePayloadSchema } from "./deployment-input";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isRequestFilterValue(value: unknown): boolean {
  if (Array.isArray(value)) {
    return value.every((item) => isRequestFilterValue(item) && !Array.isArray(item));
  }

  return typeof value === "string" || typeof value === "boolean" || (typeof value === "number" && Number.isFinite(value));
}

function stopSignalMessage(signal: GovDataStopSignal) {
  return match(signal.reason)
    .with("empty_result", () => "실행 결과가 0행이라 파이프라인을 멈췄어요.")
    .with("row_drop", () => `직전 단계 대비 행 수가 ${Math.round(signal.observed * 100)}%로 줄어 파이프라인을 멈췄어요.`)
    .with("match_rate", () => `${signal.title ?? "조인"} 매칭률이 ${Math.round(signal.observed * 100)}%로 낮아 파이프라인을 멈췄어요.`)
    .with("null_rate", () => `결과 결측률이 ${Math.round(signal.observed * 100)}%로 높아 파이프라인을 멈췄어요.`)
    .exhaustive();
}

export function resolveDeploymentInput(project: Project, body: unknown) {
  if (!isRecord(body)) {
    throw new GovDataSourceError("배포 요청은 JSON 객체여야 해요.", 400);
  }

  const unknownKeys = Object.keys(body).filter((key) => key !== "request" && key !== "schema");

  if (unknownKeys.length > 0) {
    throw new GovDataSourceError(`지원하지 않는 배포 요청 필드예요: ${unknownKeys.join(", ")}`, 400);
  }

  if (body.request !== undefined && !isRecord(body.request)) {
    throw new GovDataSourceError("배포 요청의 request는 JSON 객체여야 해요.", 400);
  }

  if (body.schema !== undefined && !isRecord(body.schema)) {
    throw new GovDataSourceError("배포 요청의 schema는 JSON 객체여야 해요.", 400);
  }

  const requestData = isRecord(body.request) ? body.request : project.workflow.requestData ?? {};

  if (requestData.filters !== undefined && !isRecord(requestData.filters)) {
    throw new GovDataSourceError("배포 요청의 request.filters는 JSON 객체여야 해요.", 400);
  }

  if (isRecord(requestData.filters) && !Object.values(requestData.filters).every(isRequestFilterValue)) {
    throw new GovDataSourceError("배포 요청의 filters 값은 문자열, 숫자, 불리언 또는 그 배열이어야 해요.", 400);
  }

  return {
    requestData,
    payloadSchema: resolvePayloadSchema(
      isRecord(body.schema) ? body.schema : undefined,
      project.workflow.payloadSchema,
    ),
  };
}

export async function runStoredDeployment(project: Project, deploymentId: string, body: unknown) {
  const operationSpec = project.workflow.operationSpec;

  if (operationSpec == null) {
    throw new GovDataSourceError("저장된 실행 파이프라인이 없어요. 캔버스에서 먼저 파이프라인을 저장하세요.", 422);
  }

  const { payloadSchema, requestData } = resolveDeploymentInput(project, body);
  let result = await runGovData(operationSpec, payloadSchema ?? undefined);

  if (isRecord(requestData.filters)) {
    try {
      result = applyGovDataRequestFilters(result, requestData.filters, payloadSchema ?? undefined);
    } catch (error) {
      throw new GovDataSourceError(error instanceof Error ? error.message : "배포 필터를 적용하지 못했어요.", 400);
    }
  }

  const stopSignal = assessGovDataRunResult(result, undefined, {
    allowPartialMatch: operationSpec.join === "left",
  });

  if (stopSignal != null) {
    throw new GovDataSourceError(stopSignalMessage(stopSignal), 422);
  }

  return {
    deploymentId,
    query: project.question,
    request_data: requestData,
    payload_schema: payloadSchema,
    result: serializeGovDataRunResult(result),
  };
}
