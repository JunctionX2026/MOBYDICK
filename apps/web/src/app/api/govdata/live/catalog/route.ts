import { errorResponse } from "@/server/govdata-http";
import { getGovDataLiveCatalog } from "@/server/govdata-source";

export async function GET() {
  try {
    return Response.json(await getGovDataLiveCatalog());
  } catch (error) {
    return errorResponse(error);
  }
}
