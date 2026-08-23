import { errorResponse } from "@/server/govdata-http";
import { getGovDataLiveCatalog, serializeGovDataLiveCatalog } from "@/server/govdata-source";

export async function GET() {
  try {
    return Response.json(serializeGovDataLiveCatalog(await getGovDataLiveCatalog()));
  } catch (error) {
    return errorResponse(error);
  }
}
