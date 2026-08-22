import { GovDataSourceError, planGovData } from "@/server/govdata-source";
import { errorResponse, isRecord } from "@/server/govdata-http";
import { findProjectByDeploymentId } from "@/server/project-repository";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const project = await findProjectByDeploymentId(id);

    if (project == null) {
      throw new GovDataSourceError("배포를 찾을 수 없어요.", 404);
    }

    const body: unknown = await request.json().catch(() => ({}));
    const query = isRecord(body) && typeof body.query === "string" && body.query.trim() !== ""
      ? body.query.trim()
      : project.question;
    const schema = isRecord(body) && isRecord(body.schema) ? body.schema : undefined;
    const plan = await planGovData(query, schema);

    return Response.json({ deploymentId: id, query, ...plan });
  } catch (error) {
    return errorResponse(error);
  }
}
