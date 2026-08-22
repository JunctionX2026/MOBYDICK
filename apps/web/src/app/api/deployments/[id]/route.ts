import { errorResponse } from "@/server/govdata-http";
import { runStoredDeployment } from "@/server/deployment-runtime";
import { findProjectByDeploymentId } from "@/server/project-repository";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const project = await findProjectByDeploymentId(id);

    if (project == null) {
      return Response.json({ error: { message: "배포를 찾을 수 없어요." } }, { status: 404 });
    }

    const body: unknown = await request.json().catch(() => ({}));
    return Response.json(await runStoredDeployment(project, id, body));
  } catch (error) {
    return errorResponse(error);
  }
}
