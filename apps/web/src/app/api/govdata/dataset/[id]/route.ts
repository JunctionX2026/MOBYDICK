import { GovDataSourceError, getGovDataDataset } from "@/server/govdata-source";
import { errorResponse } from "@/server/govdata-http";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    if (!/^[0-9A-Za-z가-힣_]+$/.test(id)) {
      throw new GovDataSourceError("데이터셋 식별자가 유효하지 않아요.", 400);
    }

    return Response.json(await getGovDataDataset(id));
  } catch (error) {
    return errorResponse(error);
  }
}
