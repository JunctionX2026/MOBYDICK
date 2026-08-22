"use client";

import { ulid } from "@mobydick/domain";
import { useMemo, useState, type ReactNode } from "react";
import { graphql, useMutation } from "react-relay";
import { buildContext } from "react-simplikit";
import type { workflowStoreSaveMutation } from "@/__generated__/relay/workflowStoreSaveMutation.graphql";
import { isGraphQLNodeKind, type GraphQLNodeKind } from "@/graphql/enums";

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
  position: CanvasPosition;
}

export interface CanvasLink {
  id: string;
  source: string;
  target: string;
}

export interface WorkflowStore {
  nodes: CanvasNode[];
  links: CanvasLink[];
  dirty: boolean;
  saving: boolean;
  error: string | null;
  addNode: (kind: CanvasNodeKind, position: CanvasPosition) => void;
  moveNode: (id: string, position: CanvasPosition) => void;
  removeNode: (id: string) => void;
  connect: (source: string, target: string) => void;
  disconnect: (id: string) => void;
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
  const [error, setError] = useState<string | null>(null);
  const [commit, saving] = useMutation<workflowStoreSaveMutation>(SaveWorkflow);

  const store = useMemo<WorkflowStore>(
    () => ({
      nodes,
      links,
      dirty,
      saving,
      error,
      addNode: (kind, position) => {
        setNodes((previous) => [
          ...previous,
          {
            id: ulid(),
            kind,
            title: DEFAULT_TITLES[kind],
            subtitle: null,
            position,
          },
        ]);
        setDirty(true);
      },
      moveNode: (id, position) => {
        setNodes((previous) =>
          previous.map((node) => (node.id === id ? { ...node, position } : node)),
        );
        setDirty(true);
      },
      removeNode: (id) => {
        setNodes((previous) => previous.filter((node) => node.id !== id));
        setLinks((previous) => previous.filter((link) => link.source !== id && link.target !== id));
        setDirty(true);
      },
      connect: (source, target) => {
        if (source === target) {
          return;
        }

        setLinks((previous) =>
          previous.some((link) => link.source === source && link.target === target)
            ? previous
            : [...previous, { id: ulid(), source, target }],
        );
        setDirty(true);
      },
      disconnect: (id) => {
        setLinks((previous) => previous.filter((link) => link.id !== id));
        setDirty(true);
      },
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
    [commit, dirty, error, links, nodes, projectId, saving],
  );

  return <StoreProvider {...store}>{children}</StoreProvider>;
}
