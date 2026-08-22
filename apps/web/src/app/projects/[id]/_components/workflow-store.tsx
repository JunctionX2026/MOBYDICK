"use client";

import { linkRejection, ulid } from "@mobydick/domain";
import { useMemo, useState, type ReactNode } from "react";
import { graphql, useMutation } from "react-relay";
import { buildContext } from "react-simplikit";
import type { workflowStoreSaveMutation } from "@/__generated__/relay/workflowStoreSaveMutation.graphql";
import { isGraphQLNodeKind, type GraphQLNodeKind } from "@/graphql/enums";
import { NODE_STEP } from "./canvas-metrics";

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
  source: string;
  target: string;
}

export type LinkRejection = ReturnType<typeof linkRejection>;

export interface WorkflowStore {
  nodes: CanvasNode[];
  links: CanvasLink[];
  dirty: boolean;
  saving: boolean;
  error: string | null;
  addNode: (kind: CanvasNodeKind, details?: { datasetId?: string | null; subtitle?: string | null; title?: string }) => string;
  applyPipeline: (nodes: CanvasNode[], links: CanvasLink[]) => void;
  lastAddedId: string | null;
  moveNodes: (moves: ReadonlyArray<{ id: string; position: CanvasPosition }>) => void;
  remove: (nodeIds: ReadonlySet<string>, linkIds: ReadonlySet<string>) => void;
  connect: (source: string, target: string) => void;
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
        }
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

const DEFAULT_TITLES: Record<CanvasNodeKind, string> = {
  SOURCE: "데이터 소스",
  TRANSFORM: "변환",
  JOIN: "조인",
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
}

export function WorkflowProvider({
  children,
  initialLinks,
  initialNodes,
  projectId,
}: WorkflowProviderProps) {
  const [nodes, setNodes] = useState<CanvasNode[]>(() => initialNodes.map((node) => ({ ...node })));
  const [links, setLinks] = useState<CanvasLink[]>(() => initialLinks.map((link) => ({ ...link })));
  const [dirty, setDirty] = useState(false);
  const [lastAddedId, setLastAddedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [commit, saving] = useMutation<workflowStoreSaveMutation>(SaveWorkflow);

  const store = useMemo<WorkflowStore>(
    () => ({
      nodes,
      links,
      dirty,
      saving,
      error,
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
        setLastAddedId(id);
        setDirty(true);

        return id;
      },
      applyPipeline: (nextNodes, nextLinks) => {
        setNodes(nextNodes);
        setLinks(nextLinks);
        setLastAddedId(null);
        setError(null);
        setDirty(true);
        commit({
          variables: { input: { id: projectId, nodes: nextNodes, links: nextLinks } },
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
        setDirty(true);
      },
      connect: (source, target) => {
        if (linkRejection(links, source, target) != null) {
          return;
        }

        setLinks((previous) =>
          linkRejection(previous, source, target) != null
            ? previous
            : [...previous, { id: ulid(), source, target }],
        );
        setDirty(true);
      },
      rejectionFor: (source, target) => linkRejection(links, source, target),
      save: () => {
        setError(null);
        commit({
          variables: { input: { id: projectId, nodes, links } },
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
    [commit, dirty, error, lastAddedId, links, nodes, projectId, saving],
  );

  return <StoreProvider {...store}>{children}</StoreProvider>;
}
