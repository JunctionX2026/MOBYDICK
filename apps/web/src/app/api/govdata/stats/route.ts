import { errorResponse } from "@/server/govdata-http";
import { getGovDataStats } from "@/server/govdata-source";

export async function GET() {
  try {
    return Response.json(await getGovDataStats());
  } catch (error) {
    return errorResponse(error);
  }
}
