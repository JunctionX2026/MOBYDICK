import { GovDataSourceError } from "@/server/govdata-source";
import { errorResponse, isRecord, requestJson } from "@/server/govdata-http";
import { recommendGovData } from "@/server/govdata-source";

export async function POST(request: Request) {
  try {
    const body = await requestJson(request);
    const query = isRecord(body) && typeof body.query === "string" ? body.query.trim() : "";
    const rawK = isRecord(body) ? body.k : undefined;
    const k = rawK == null ? 8 : rawK;

    if (query === "") {
      throw new GovDataSourceError("추천 질문을 입력하세요.", 400);
    }

    if (typeof k !== "number" || !Number.isInteger(k) || k < 1 || k > 20) {
      throw new GovDataSourceError("추천 결과 수는 1에서 20 사이여야 해요.", 400);
    }

    return Response.json(await recommendGovData(query, k));
  } catch (error) {
    return errorResponse(error);
  }
}
