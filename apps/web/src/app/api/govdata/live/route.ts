import {
  GovDataSourceError,
  executeGovDataLive,
  serializeGovDataLiveResult,
} from "@/server/govdata-source";
import { errorResponse, isRecord, requestJson } from "@/server/govdata-http";

export async function POST(request: Request) {
  try {
    const body = await requestJson(request);
    const service = isRecord(body) && typeof body.service === "string" ? body.service.trim() : "";
    const operation = isRecord(body) && typeof body.operation === "string" ? body.operation.trim() : undefined;
    const payload = isRecord(body) && isRecord(body.payload) ? body.payload : null;

    if (service === "") {
      throw new GovDataSourceError("공공데이터 서비스 식별자를 입력하세요.", 400);
    }
    if (payload == null) {
      throw new GovDataSourceError("공공데이터 payload는 JSON 객체여야 해요.", 400);
    }

    return Response.json(serializeGovDataLiveResult(await executeGovDataLive(service, operation || undefined, payload)));
  } catch (error) {
    return errorResponse(error);
  }
}
