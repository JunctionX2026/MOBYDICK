import { StorageError, deployProject, findProject } from "@/server/project-repository";

function deploymentOrigin(request: Request) {
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const protocol = request.headers.get("x-forwarded-proto") ?? new URL(request.url).protocol.replace(":", "");
  return host == null ? new URL(request.url).origin : `${protocol}://${host.split(",")[0].trim()}`;
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await findProject(id);

  if (project == null) {
    return Response.json({ error: { message: "프로젝트를 찾을 수 없어요." } }, { status: 404 });
  }

  if (project.workflow.operationSpec == null) {
    return Response.json(
      { error: { message: "저장된 실행 파이프라인이 없어 배포할 수 없어요." } },
      { status: 422 },
    );
  }

  let deployed;

  try {
    deployed = await deployProject(project.id);
  } catch (error) {
    if (error instanceof StorageError) {
      return Response.json({ error: { message: error.message } }, { status: 422 });
    }

    throw error;
  }
  const origin = deploymentOrigin(request);
  const deploymentId = deployed.deploymentId;

  return Response.json({
    apiUrl: `${origin}/api/deployments/${deploymentId}`,
    deploymentId,
    mcpUrl: `${origin}/api/mcp/${deploymentId}`,
  });
}
