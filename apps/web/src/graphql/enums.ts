import type { ProjectPhase, WorkflowNodeKind } from "@mobydick/domain";

export type GraphQLNodeKind = "SOURCE" | "OPERATION" | "OUTPUT";
export type GraphQLProjectPhase = "DISCOVER" | "COMPOSE" | "SERVE";

export const NODE_KIND_TO_GRAPHQL: Record<WorkflowNodeKind, GraphQLNodeKind> = {
  source: "SOURCE",
  operation: "OPERATION",
  output: "OUTPUT",
};

export const NODE_KIND_FROM_GRAPHQL: Record<GraphQLNodeKind, WorkflowNodeKind> = {
  SOURCE: "source",
  OPERATION: "operation",
  OUTPUT: "output",
};

export const PROJECT_PHASE_TO_GRAPHQL: Record<ProjectPhase, GraphQLProjectPhase> = {
  discover: "DISCOVER",
  compose: "COMPOSE",
  serve: "SERVE",
};

export function isGraphQLNodeKind(value: string): value is GraphQLNodeKind {
  return Object.hasOwn(NODE_KIND_FROM_GRAPHQL, value);
}
