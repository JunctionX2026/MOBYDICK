import type { Project } from "@mobydick/domain";
import { GovDataSourceError, runGovData, serializeGovDataRunResult } from "./govdata-source";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function runStoredDeployment(project: Project, deploymentId: string, body: unknown) {
  const operationSpec = project.workflow.operationSpec;

  if (operationSpec == null) {
    throw new GovDataSourceError("저장된 실행 파이프라인이 없어요. 캔버스에서 먼저 파이프라인을 저장하세요.", 422);
  }

  const input = isRecord(body) ? body : {};
  const requestData = isRecord(input.request)
    ? input.request
    : project.workflow.requestData ?? {};
  const payloadSchema = isRecord(input.schema)
    ? input.schema
    : project.workflow.payloadSchema;
  const result = await runGovData(operationSpec, payloadSchema ?? undefined);

  return {
    deploymentId,
    query: project.question,
    request_data: requestData,
    payload_schema: payloadSchema,
    result: serializeGovDataRunResult(result),
  };
}
