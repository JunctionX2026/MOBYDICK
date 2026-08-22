import { graphql } from "graphql";
import { rootValue, schema } from "@/server/graphql";

interface GraphQLRequestBody {
  query?: unknown;
  variables?: unknown;
  operationName?: unknown;
}

function isVariables(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function POST(request: Request) {
  let body: GraphQLRequestBody;

  try {
    body = await request.json();
  } catch {
    return Response.json(
      { errors: [{ message: "The request body is not JSON." }] },
      { status: 400 },
    );
  }

  if (typeof body.query !== "string") {
    return Response.json(
      { errors: [{ message: "The request body needs a query string." }] },
      { status: 400 },
    );
  }

  const result = await graphql({
    schema: schema(),
    source: body.query,
    rootValue,
    variableValues: isVariables(body.variables) ? body.variables : undefined,
    operationName: typeof body.operationName === "string" ? body.operationName : undefined,
  });

  return Response.json(result);
}
