import { GovDataSourceError, planGovData, serializeGovDataPlan } from "@/server/govdata-source";
import { errorResponse, isRecord, requestJson } from "@/server/govdata-http";

export async function POST(request: Request) {
  try {
    const body = await requestJson(request);
    const query = isRecord(body) && typeof body.query === "string" ? body.query.trim() : "";
    const schema = isRecord(body) && isRecord(body.schema) ? body.schema : undefined;

    if (query === "") {
      throw new GovDataSourceError("실행 계획 질문을 입력하세요.", 400);
    }

    return Response.json(serializeGovDataPlan(await planGovData(query, schema)));
  } catch (error) {
    return errorResponse(error);
  }
}
