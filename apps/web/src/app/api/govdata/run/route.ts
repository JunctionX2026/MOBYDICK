import { parseGovDataOperationSpec } from "@mobydick/domain";
import { GovDataSourceError, runGovData, serializeGovDataRunResult } from "@/server/govdata-source";
import { errorResponse, isRecord, requestJson } from "@/server/govdata-http";

export async function POST(request: Request) {
  try {
    const body = await requestJson(request);
    const spec = isRecord(body) ? parseGovDataOperationSpec(body.spec) : null;
    const schema = isRecord(body) && isRecord(body.schema) ? body.schema : undefined;

    if (spec == null) {
      throw new GovDataSourceError("실행 스펙이 OperationSpec 계약과 맞지 않아요.", 400);
    }

    return Response.json(serializeGovDataRunResult(await runGovData(spec, schema)));
  } catch (error) {
    return errorResponse(error);
  }
}
