import { GovDataSourceError } from "./govdata-source";

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function requestJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new GovDataSourceError("요청 본문이 JSON이 아니에요.", 400);
  }
}

export function errorResponse(error: unknown) {
  if (error instanceof GovDataSourceError) {
    return Response.json({ error: { message: error.message } }, { status: error.status });
  }

  return Response.json({ error: { message: "데이터 소스 요청을 처리하지 못했어요." } }, { status: 500 });
}
