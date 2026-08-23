"use client";

import {
  assessGovDataRunResult,
  linkRejection,
  parseGovDataPlan,
  parseGovDataRunResult,
  serializeGovDataOperationSpec,
  ulid,
  type GovDataOperationSpec,
  type GovDataPlan,
  type GovDataRunResult,
  type GovDataStopSignal,
} from "@mobydick/domain";
import { useMemo, useState, type ReactNode } from "react";
import { graphql, useMutation } from "react-relay";
import { buildContext } from "react-simplikit";
import { match } from "ts-pattern";
import type { workflowStoreSaveMutation } from "@/__generated__/relay/workflowStoreSaveMutation.graphql";
import { isGraphQLNodeKind, type GraphQLNodeKind } from "@/graphql/enums";
import { NODE_STEP } from "./canvas-metrics";
import { toGovDataOperationSpecWire } from "./govdata-wire";

export type CanvasNodeKind = GraphQLNodeKind;

export interface CanvasPosition {
  x: number;
  y: number;
}

export interface CanvasNode {
  id: string;
  kind: CanvasNodeKind;
  title: string;
  subtitle: string | null;
  datasetId: string | null;
  position: CanvasPosition;
}

export interface CanvasLink {
  id: string;
  intent: string | null;
  source: string;
  target: string;
}

export type WorkflowExecutionStatus = "idle" | "running" | "success" | "error";

export interface WorkflowExecution {
  status: WorkflowExecutionStatus;
  nodeId: string | null;
  nodeTitle: string | null;
  request: { method: "POST"; path: string; body: unknown } | null;
  result: GovDataRunResult | null;
  error: string | null;
}

export interface WorkflowNodeExecution {
  status: WorkflowExecutionStatus;
  result: GovDataRunResult | null;
  error: string | null;
}

export type LinkRejection = ReturnType<typeof linkRejection>;

export interface WorkflowStore {
  nodes: CanvasNode[];
  links: CanvasLink[];
  canDeploy: boolean;
  dirty: boolean;
  saving: boolean;
  error: string | null;
  execution: WorkflowExecution;
  nodeExecutions: Readonly<Record<string, WorkflowNodeExecution>>;
  operationSpec: GovDataOperationSpec | null;
  plan: GovDataPlan | null;
  addNode: (kind: CanvasNodeKind, details?: { datasetId?: string | null; subtitle?: string | null; title?: string }) => string;
  applyPipeline: (nodes: CanvasNode[], links: CanvasLink[], plan?: GovDataPlan) => void;
  executeLastNode: () => Promise<void>;
  executeNode: (nodeId: string) => Promise<void>;
  lastAddedId: string | null;
  moveNodes: (moves: ReadonlyArray<{ id: string; position: CanvasPosition }>) => void;
  remove: (nodeIds: ReadonlySet<string>, linkIds: ReadonlySet<string>) => void;
  connect: (source: string, target: string, intent?: string | null, spec?: GovDataOperationSpec | null) => void;
  rejectionFor: (source: string, target: string) => LinkRejection;
  save: () => void;
}

const SaveWorkflow = graphql`
  mutation workflowStoreSaveMutation($input: SaveWorkflowInput!) {
    saveWorkflow(input: $input) {
      id
      phase
      updatedAt
      workflow {
        nodes {
          id
          kind
          title
          subtitle
          datasetId
          position {
            x
            y
          }
        }
        links {
          id
          source
          target
          intent
        }
        operationSpecJson
        requestDataJson
        payloadSchemaJson
      }
    }
  }
`;

const [StoreProvider, useWorkflow] = buildContext<WorkflowStore>("Workflow", undefined);

export { useWorkflow };

/**
 * Relay widens enums with `%future added value`, so canvas state only accepts
 * kinds the compiled schema knows. Unknown kinds are counted, never hidden.
 */
export function toCanvasNodes(
  nodes: ReadonlyArray<{
    id: string;
    kind: string;
    title: string;
    subtitle: string | null | undefined;
    datasetId: string | null | undefined;
    position: { x: number; y: number };
  }>,
): { droppedCount: number; nodes: CanvasNode[] } {
  const known = nodes.flatMap<CanvasNode>((node) =>
    isGraphQLNodeKind(node.kind)
      ? [
          {
            id: node.id,
            kind: node.kind,
            title: node.title,
            subtitle: node.subtitle ?? null,
            datasetId: node.datasetId ?? null,
            position: { x: node.position.x, y: node.position.y },
          },
        ]
      : [],
  );

  return { droppedCount: nodes.length - known.length, nodes: known };
}

const EMPTY_EXECUTION: WorkflowExecution = {
  status: "idle",
  nodeId: null,
  nodeTitle: null,
  request: null,
  result: null,
  error: null,
};

function errorMessage(value: unknown, fallback: string) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return fallback;
  }

  const error = (value as Record<string, unknown>).error;

  if (typeof error !== "object" || error === null || Array.isArray(error)) {
    return fallback;
  }

  const message = (error as Record<string, unknown>).message;
  return typeof message === "string" && message.trim() !== "" ? message : fallback;
}

function stopSignalMessage(signal: GovDataStopSignal) {
  return match(signal.reason)
    .with("empty_result", () => "실행 결과가 0행이라 파이프라인을 멈췄어요.")
    .with("row_drop", () => `직전 단계 대비 행 수가 ${Math.round(signal.observed * 100)}%로 줄어 파이프라인을 멈췄어요.`)
    .with("match_rate", () => `${signal.title ?? "조인"} 매칭률이 ${Math.round(signal.observed * 100)}%로 낮아 파이프라인을 멈췄어요.`)
    .with("null_rate", () => `결과 결측률이 ${Math.round(signal.observed * 100)}%로 높아 파이프라인을 멈췄어요.`)
    .exhaustive();
}

async function loadExecutionPlan(question: string) {
  const response = await fetch("/api/govdata/plan", {
    body: JSON.stringify({ query: question }),
    headers: { "content-type": "application/json" },
    method: "POST",
  });
  const payload: unknown = await response.json();

  if (!response.ok) {
    throw new Error(errorMessage(payload, "질문을 실행 계획으로 바꾸지 못했어요."));
  }

  const plan = parseGovDataPlan(payload);

  if (plan == null) {
    throw new Error("실행 계획 응답이 데이터 계약과 맞지 않아요.");
  }

  return plan;
}

async function runExecutionSpec(spec: GovDataOperationSpec) {
  const body = { spec: toGovDataOperationSpecWire(spec) };
  const response = await fetch("/api/govdata/run", {
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
    method: "POST",
  });
  const payload: unknown = await response.json();

  if (!response.ok) {
    throw new Error(errorMessage(payload, "데이터 소스를 실행하지 못했어요."));
  }

  const result = parseGovDataRunResult(payload);

  if (result == null) {
    throw new Error("실행 응답이 데이터 계약과 맞지 않아요.");
  }

  return { body, result };
}

function upstreamNodeIds(nodeId: string, links: readonly CanvasLink[]) {
  const parents = new Map<string, string[]>();

  for (const link of links) {
    parents.set(link.target, [...(parents.get(link.target) ?? []), link.source]);
  }

  const result = new Set<string>([nodeId]);
  const queue = [nodeId];

  while (queue.length > 0) {
    const current = queue.shift();

    if (current == null) {
      continue;
    }

    for (const parent of parents.get(current) ?? []) {
      if (result.has(parent)) {
        continue;
      }

      result.add(parent);
      queue.push(parent);
    }
  }

  return result;
}

function stageRank(kind: CanvasNodeKind) {
  return kind === "OPERATION" ? 0 : 1;
}

const DEFAULT_TITLES: Record<CanvasNodeKind, string> = {
  SOURCE: "데이터 소스",
  OPERATION: "조인·변환",
  OUTPUT: "출력",
};

/** New nodes land to the right of the pipe so the palette never stacks them. */
function nextPosition(nodes: readonly CanvasNode[]): CanvasPosition {
  const rightmost = nodes.reduce<CanvasNode | null>(
    (found, node) => (found == null || node.position.x > found.position.x ? node : found),
    null,
  );

  return rightmost == null
    ? { x: 0, y: 0 }
    : { x: rightmost.position.x + NODE_STEP, y: rightmost.position.y };
}

export interface WorkflowProviderProps {
  children: ReactNode;
  initialLinks: readonly CanvasLink[];
  initialNodes: readonly CanvasNode[];
  projectId: string;
  question: string;
  initialOperationSpec: GovDataOperationSpec | null;
  initialRequestData: Record<string, unknown>;
  initialPayloadSchema: Record<string, unknown> | null;
}

export function WorkflowProvider({
  children,
  initialLinks,
  initialNodes,
  initialOperationSpec,
  initialPayloadSchema,
  initialRequestData,
  projectId,
  question,
}: WorkflowProviderProps) {
  const [nodes, setNodes] = useState<CanvasNode[]>(() => initialNodes.map((node) => ({ ...node })));
  const [links, setLinks] = useState<CanvasLink[]>(() =>
    initialLinks.map((link) => ({ ...link, intent: link.intent ?? null })),
  );
  const [dirty, setDirty] = useState(false);
  const [lastAddedId, setLastAddedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [execution, setExecution] = useState<WorkflowExecution>(EMPTY_EXECUTION);
  const [nodeExecutions, setNodeExecutions] = useState<Record<string, WorkflowNodeExecution>>({});
  const [plan, setPlan] = useState<GovDataPlan | null>(null);
  const [operationSpec, setOperationSpec] = useState<GovDataOperationSpec | null>(initialOperationSpec);
  const [requestData] = useState(initialRequestData);
  const [payloadSchema] = useState(initialPayloadSchema);
  const [commit, saving] = useMutation<workflowStoreSaveMutation>(SaveWorkflow);

  const workflowInput = (
    nextNodes: readonly CanvasNode[],
    nextLinks: readonly CanvasLink[],
    nextSpec: GovDataOperationSpec | null,
  ) => ({
    id: projectId,
    nodes: nextNodes,
    links: nextLinks,
    operationSpecJson: nextSpec == null ? null : JSON.stringify(serializeGovDataOperationSpec(nextSpec)),
    requestDataJson: JSON.stringify(requestData),
    payloadSchemaJson: payloadSchema == null ? null : JSON.stringify(payloadSchema),
  });

  const executeNode = async (nodeId: string) => {
    const node = nodes.find((candidate) => candidate.id === nodeId);

    if (node == null) {
      return;
    }

    setExecution({
      status: "running",
      nodeId: node.id,
      nodeTitle: node.title,
      request: null,
      result: null,
      error: null,
    });
    setNodeExecutions((previous) => ({
      ...previous,
      [node.id]: { status: "running", result: null, error: null },
    }));

    try {
      const currentSpec = plan?.spec ?? operationSpec ?? (await loadExecutionPlan(question)).spec;

      if (plan == null && operationSpec == null) {
        setOperationSpec(currentSpec);
      }

      const source = currentSpec.sources.find((candidate) => candidate.datasetId === node.datasetId);

      if (node.kind === "SOURCE" && source == null) {
        throw new Error("소스 노드에 실행할 데이터셋이 없어요.");
      }

      if (node.kind !== "SOURCE") {
        const upstreamIds = upstreamNodeIds(node.id, links);
        const sourceNodes = nodes.filter(
          (candidate) => upstreamIds.has(candidate.id) && candidate.kind === "SOURCE" && candidate.datasetId != null,
        );
        const stageNodes = nodes
          .filter((candidate) => upstreamIds.has(candidate.id) && candidate.kind !== "SOURCE")
          .sort((left, right) => stageRank(left.kind) - stageRank(right.kind));
        setNodeExecutions((previous) => {
          const next = { ...previous };

          for (const candidate of [...sourceNodes, ...stageNodes]) {
            next[candidate.id] = { status: "running", result: null, error: null };
          }

          return next;
        });
        const previews = await Promise.all(
          sourceNodes.map(async (sourceNode) => {
            const sourceSpec = currentSpec.sources.find(
              (candidate) => candidate.datasetId === sourceNode.datasetId,
            );

            if (sourceSpec == null) {
              return {
                error: "실행 계획에 데이터셋이 없어요.",
                nodeId: sourceNode.id,
                result: null,
              };
            }

            try {
              const { result: sourceResult } = await runExecutionSpec({
                sources: [sourceSpec],
                orderBy: [],
                limit: currentSpec.limit,
              });

              return { error: null, nodeId: sourceNode.id, result: sourceResult };
            } catch (reason) {
              return {
                error: reason instanceof Error ? reason.message : "소스 실행에 실패했어요.",
                nodeId: sourceNode.id,
                result: null,
              };
            }
          }),
        );

        setNodeExecutions((previous) => {
          const next = { ...previous };

          for (const preview of previews) {
            next[preview.nodeId] =
              preview.error == null
                ? { status: "success", result: preview.result, error: null }
                : { status: "error", result: null, error: preview.error };
          }

          return next;
        });

        const failedPreview = previews.find((preview) => preview.error != null);

        if (failedPreview != null) {
          const failedNode = sourceNodes.find((sourceNode) => sourceNode.id === failedPreview.nodeId);
          throw new Error(`${failedNode?.title ?? "소스"}: ${failedPreview.error}`);
        }

        const sourceQualityFailure = previews
          .map((preview) => ({
            preview,
            signal: preview.result == null ? null : assessGovDataRunResult(preview.result),
          }))
          .find((item) => item.signal != null);

        if (sourceQualityFailure?.signal != null) {
          const failedNode = sourceNodes.find((sourceNode) => sourceNode.id === sourceQualityFailure.preview.nodeId);
          const message = stopSignalMessage(sourceQualityFailure.signal);
          setNodeExecutions((previous) => ({
            ...previous,
            [sourceQualityFailure.preview.nodeId]: { status: "error", result: null, error: message },
          }));
          throw new Error(`${failedNode?.title ?? "소스"}: ${message}`);
        }

        let latestStage: { body: { spec: unknown }; result: GovDataRunResult } | null = null;

        for (const stageNode of stageNodes) {
          if (stageNode.kind === "OUTPUT" && latestStage != null) {
            const outputStage = latestStage;
            setNodeExecutions((previous) => ({
              ...previous,
              [stageNode.id]: { status: "success", result: outputStage.result, error: null },
            }));
            continue;
          }

          const stageSpec =
            stageNode.kind === "OPERATION"
              ? { ...currentSpec, orderBy: [], limit: 1000 }
              : currentSpec;

          try {
            const stageExecution = await runExecutionSpec(stageSpec);
            const baselineRowCount =
              stageNode.kind === "OPERATION"
                ? Math.min(...previews.map((preview) => preview.result?.rowCount ?? 0))
                : latestStage?.result.rowCount;
            const stopSignal = assessGovDataRunResult(stageExecution.result, baselineRowCount, {
              allowPartialMatch: currentSpec.join === "left",
            });

            if (stopSignal != null) {
              const message = stopSignalMessage(stopSignal);
              const request = { method: "POST" as const, path: "/api/govdata/run", body: stageExecution.body };
              setNodeExecutions((previous) => ({
                ...previous,
                [stageNode.id]: { status: "error", result: stageExecution.result, error: message },
              }));
              setExecution({
                status: "error",
                nodeId: node.id,
                nodeTitle: node.title,
                request,
                result: stageExecution.result,
                error: message,
              });
              throw new Error(message);
            }

            latestStage = stageExecution;
            setNodeExecutions((previous) => ({
              ...previous,
              [stageNode.id]: { status: "success", result: latestStage?.result ?? null, error: null },
            }));
          } catch (reason) {
            const message = reason instanceof Error ? reason.message : "노드를 실행하지 못했어요.";
            setNodeExecutions((previous) => ({
              ...previous,
              [stageNode.id]: { status: "error", result: previous[stageNode.id]?.result ?? null, error: message },
            }));
            throw new Error(`${stageNode.title}: ${message}`);
          }
        }

        if (latestStage != null) {
          setExecution({
            status: "success",
            nodeId: node.id,
            nodeTitle: node.title,
            request: { method: "POST", path: "/api/govdata/run", body: latestStage.body },
            result: latestStage.result,
            error: null,
          });
          setNodeExecutions((previous) => ({
            ...previous,
            [node.id]: { status: "success", result: latestStage?.result ?? null, error: null },
          }));
          return;
        }
      }

      const spec = node.kind === "SOURCE" && source != null
        ? { sources: [source], orderBy: [], limit: currentSpec.limit }
        : currentSpec;
      const { body, result } = await runExecutionSpec(spec);

      setExecution({
        status: "success",
        nodeId: node.id,
        nodeTitle: node.title,
        request: { method: "POST", path: "/api/govdata/run", body },
        result,
        error: null,
      });
      setNodeExecutions((previous) => ({
        ...previous,
        [node.id]: { status: "success", result, error: null },
      }));
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : "노드를 실행하지 못했어요.";
      setExecution((previous) => ({
        ...previous,
        status: "error",
        error: message,
      }));
      setNodeExecutions((previous) => ({
        ...previous,
        [node.id]: { status: "error", result: previous[node.id]?.result ?? null, error: message },
      }));
    }
  };

  const executeLastNode = async () => {
    const output = nodes.find((node) => node.kind === "OUTPUT");
    const sink = output ?? nodes.find((node) => !links.some((link) => link.source === node.id));
    const last = sink ?? nodes.at(-1);

    if (last != null) {
      await executeNode(last.id);
    }
  };

  const store = useMemo<WorkflowStore>(
    () => ({
      nodes,
      links,
      canDeploy: operationSpec != null,
      dirty,
      saving,
      error,
      execution,
      nodeExecutions,
      operationSpec,
      plan,
      addNode: (kind, details) => {
        const id = ulid();

        setNodes((previous) => [
          ...previous,
          {
            id,
            kind,
            title: details?.title ?? DEFAULT_TITLES[kind],
            subtitle: details?.subtitle ?? null,
            datasetId: details?.datasetId ?? null,
            position: nextPosition(previous),
          },
        ]);
        setPlan(null);
        setOperationSpec(null);
        setExecution(EMPTY_EXECUTION);
        setNodeExecutions({});
        setLastAddedId(id);
        setDirty(true);

        return id;
      },
      applyPipeline: (nextNodes, nextLinks, nextPlan) => {
        setNodes(nextNodes);
        setLinks(nextLinks);
        setPlan(nextPlan ?? null);
        setOperationSpec(nextPlan?.spec ?? null);
        setExecution(EMPTY_EXECUTION);
        setNodeExecutions({});
        setLastAddedId(null);
        setError(null);
        setDirty(true);
        commit({
          variables: { input: workflowInput(nextNodes, nextLinks, nextPlan?.spec ?? null) },
          onCompleted: (_response, errors) => {
            if (errors != null && errors.length > 0) {
              setError(errors[0]?.message ?? "생성한 파이프라인을 저장하지 못했어요.");
              return;
            }

            setDirty(false);
          },
          onError: (reason) => setError(reason.message),
        });
      },
      lastAddedId,
      moveNodes: (moves) => {
        const next = new Map(moves.map((move) => [move.id, move.position]));

        setNodes((previous) =>
          previous.map((node) => {
            const position = next.get(node.id);

            return position == null ? node : { ...node, position };
          }),
        );
        setDirty(true);
      },
      remove: (nodeIds, linkIds) => {
        if (nodeIds.size === 0 && linkIds.size === 0) {
          return;
        }

        setNodes((previous) => previous.filter((node) => !nodeIds.has(node.id)));
        setLinks((previous) =>
          previous.filter(
            (link) =>
              !linkIds.has(link.id) && !nodeIds.has(link.source) && !nodeIds.has(link.target),
          ),
        );
        setPlan(null);
        setOperationSpec(null);
        setExecution(EMPTY_EXECUTION);
        setNodeExecutions({});
        setDirty(true);
      },
      connect: (source, target, intent = null, spec = null) => {
        if (linkRejection(links, source, target) != null) {
          return;
        }

        setLinks((previous) =>
          linkRejection(previous, source, target) != null
            ? previous
            : [...previous, { id: ulid(), intent, source, target }],
        );
        setPlan(null);
        setOperationSpec(spec);
        setExecution(EMPTY_EXECUTION);
        setNodeExecutions({});
        setDirty(true);
      },
      rejectionFor: (source, target) => linkRejection(links, source, target),
      executeLastNode,
      executeNode,
      save: () => {
        setError(null);
        commit({
          variables: { input: workflowInput(nodes, links, operationSpec) },
          onCompleted: (_response, errors) => {
            if (errors != null && errors.length > 0) {
              setError(errors[0]?.message ?? "워크플로를 저장하지 못했어요.");
              return;
            }

            setDirty(false);
          },
          onError: (reason) => setError(reason.message),
        });
      },
    }),
    [commit, dirty, error, execution, executeLastNode, executeNode, lastAddedId, links, nodeExecutions, nodes, operationSpec, payloadSchema, plan, projectId, requestData, saving],
  );

  return <StoreProvider {...store}>{children}</StoreProvider>;
}
