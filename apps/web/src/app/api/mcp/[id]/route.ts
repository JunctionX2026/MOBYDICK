import { GovDataSourceError } from "@/server/govdata-source";
import { runStoredDeployment } from "@/server/deployment-runtime";
import { isRecord } from "@/server/govdata-http";
import { findProjectByDeploymentId } from "@/server/project-repository";

const tool = {
  description: "Run a deployed MOBYDICK GovData pipeline and return JSON-compatible results.",
  inputSchema: {
    additionalProperties: false,
    properties: {
      request: {
        type: "object",
        properties: {
          filters: { type: "object" },
        },
      },
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

function jsonRpcError(id: unknown, code: number, message: string, status = 200) {
  return Response.json({ error: { code, message }, id, jsonrpc: "2.0" }, { status });
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  if ((await findProjectByDeploymentId(id)) == null) {
    return Response.json({ error: { message: "배포를 찾을 수 없어요." } }, { status: 404 });
  }

  return Response.json({
    deploymentId: id,
    name: "MOBYDICK GovData MCP",
    transport: "POST JSON-RPC",
    tools: [tool],
  });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return jsonRpcError(null, -32700, "Parse error");
  }

  if (!isRecord(body)) {
    return jsonRpcError(null, -32600, "Invalid Request");
  }

  const rpcId = body.id ?? null;
  const method = typeof body.method === "string" ? body.method : "";

  try {
    const project = await findProjectByDeploymentId(id);

    if (project == null) {
      return jsonRpcError(rpcId, -32004, "Deployment not found", 404);
    }

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
      return jsonRpcError(rpcId, -32601, "Method not found");
    }

    const paramsValue = isRecord(body.params) ? body.params : null;

    if (paramsValue == null || paramsValue.name !== tool.name) {
      return jsonRpcError(rpcId, -32602, "Unknown or invalid tool");
    }

    if (paramsValue.arguments !== undefined && !isRecord(paramsValue.arguments)) {
      return jsonRpcError(rpcId, -32602, "Tool arguments must be a JSON object");
    }

    const argumentsValue = paramsValue.arguments ?? {};
    const payload = await runStoredDeployment(project, id, argumentsValue);

    return jsonRpc(rpcId, {
      content: [{ text: JSON.stringify(payload), type: "text" }],
      structuredContent: payload,
    });
  } catch (error) {
    if (error instanceof GovDataSourceError) {
      return jsonRpcError(rpcId, error.status >= 500 ? -32603 : -32602, error.message);
    }

    return jsonRpcError(rpcId, -32603, "Internal error");
  }
}
