import { GovDataSourceError, planGovData } from "@/server/govdata-source";
import { errorResponse, isRecord } from "@/server/govdata-http";
import { findProjectByDeploymentId } from "@/server/project-repository";

const tool = {
  description: "Run a deployed MOBYDICK GovData pipeline and return JSON-compatible results.",
  inputSchema: {
    additionalProperties: false,
    properties: {
      query: { type: "string" },
      schema: { type: "object" },
    },
    required: [],
    type: "object",
  },
  name: "query_project",
};

function jsonRpc(id: unknown, result: unknown) {
  return Response.json({ id, jsonrpc: "2.0", result });
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return Response.json({
    deploymentId: id,
    name: "MOBYDICK GovData MCP",
    transport: "POST JSON-RPC",
    tools: [tool],
  });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const project = await findProjectByDeploymentId(id);

    if (project == null) {
      throw new GovDataSourceError("배포를 찾을 수 없어요.", 404);
    }

    const body: unknown = await request.json();
    const rpcId = isRecord(body) ? body.id ?? null : null;
    const method = isRecord(body) && typeof body.method === "string" ? body.method : "";

    if (method === "notifications/initialized") {
      return new Response(null, { status: 202 });
    }

    if (method === "initialize") {
      return jsonRpc(rpcId, {
        capabilities: { tools: {} },
        protocolVersion: "2025-06-18",
        serverInfo: { name: "MOBYDICK GovData", version: "0.1.0" },
      });
    }

    if (method === "tools/list") {
      return jsonRpc(rpcId, { tools: [tool] });
    }

    if (method !== "tools/call") {
      return jsonRpc(rpcId, { error: { code: -32601, message: "Method not found" } });
    }

    const paramsValue = isRecord(body) && isRecord(body.params) ? body.params : null;
    const argumentsValue = paramsValue != null && isRecord(paramsValue.arguments) ? paramsValue.arguments : {};
    const query = typeof argumentsValue.query === "string" && argumentsValue.query.trim() !== ""
      ? argumentsValue.query.trim()
      : project.question;
    const schema = isRecord(argumentsValue.schema) ? argumentsValue.schema : undefined;
    const plan = await planGovData(query, schema);
    const payload = { deploymentId: id, query, ...plan };

    return jsonRpc(rpcId, {
      content: [{ text: JSON.stringify(payload), type: "text" }],
      structuredContent: payload,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
