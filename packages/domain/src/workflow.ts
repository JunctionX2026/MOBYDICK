import { parseGovDataOperationSpec, type GovDataOperationSpec } from "./govdata";

export type WorkflowNodeKind = "source" | "operation" | "output";

const NODE_KINDS: readonly WorkflowNodeKind[] = ["source", "operation", "output"];

export interface WorkflowNodePosition {
  x: number;
  y: number;
}

export interface WorkflowNode {
  id: string;
  kind: WorkflowNodeKind;
  title: string;
  subtitle: string | null;
  datasetId: string | null;
  position: WorkflowNodePosition;
}

export interface WorkflowLink {
  id: string;
  source: string;
  target: string;
  intent: string | null;
}

export interface Workflow {
  nodes: WorkflowNode[];
  links: WorkflowLink[];
  operationSpec?: GovDataOperationSpec | null;
  requestData?: Record<string, unknown>;
  payloadSchema?: Record<string, unknown> | null;
}

export const EMPTY_WORKFLOW: Workflow = { nodes: [], links: [] };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim() !== "";
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function parseJsonObject(value: unknown): Record<string, unknown> | null {
  return isRecord(value) ? value : null;
}

function isNodeKind(value: unknown): value is WorkflowNodeKind {
  return typeof value === "string" && NODE_KINDS.includes(value as WorkflowNodeKind);
}

function parsePosition(value: unknown): WorkflowNodePosition | null {
  if (!isRecord(value) || !isFiniteNumber(value.x) || !isFiniteNumber(value.y)) {
    return null;
  }

  return { x: value.x, y: value.y };
}

function parseNode(value: unknown): WorkflowNode | null {
  if (!isRecord(value)) {
    return null;
  }

  const { datasetId, id, kind, position, subtitle, title } = value;

  if (!isNonEmptyString(id) || !isNodeKind(kind) || !isNonEmptyString(title)) {
    return null;
  }

  if (subtitle != null && typeof subtitle !== "string") {
    return null;
  }

  if (datasetId != null && !isNonEmptyString(datasetId)) {
    return null;
  }

  const parsedPosition = parsePosition(position);

  if (parsedPosition == null) {
    return null;
  }

  return {
    id,
    kind,
    title,
    subtitle: subtitle ?? null,
    datasetId: datasetId ?? null,
    position: parsedPosition,
  };
}

function parseLink(value: unknown, nodeIds: ReadonlySet<string>): WorkflowLink | null {
  if (!isRecord(value)) {
    return null;
  }

  const { id, intent, source, target } = value;

  if (!isNonEmptyString(id) || !isNonEmptyString(source) || !isNonEmptyString(target)) {
    return null;
  }

  if (!nodeIds.has(source) || !nodeIds.has(target) || source === target) {
    return null;
  }

  if (intent != null && !isNonEmptyString(intent)) {
    return null;
  }

  return { id, intent: intent == null ? null : intent.trim(), source, target };
}

/**
 * The canvas hands this shape to deployment, so a workflow that reached storage
 * is validated rather than asserted. A link pointing at a node that is not in
 * the same workflow makes the whole workflow unusable, so it fails the parse
 * instead of being dropped on its own.
 */
export function parseWorkflow(value: unknown): Workflow | null {
  if (!isRecord(value) || !Array.isArray(value.nodes) || !Array.isArray(value.links)) {
    return null;
  }

  const nodes: WorkflowNode[] = [];
  const nodeIds = new Set<string>();

  for (const candidate of value.nodes) {
    const node = parseNode(candidate);

    if (node == null || nodeIds.has(node.id)) {
      return null;
    }

    nodeIds.add(node.id);
    nodes.push(node);
  }

  const links: WorkflowLink[] = [];
  const linkIds = new Set<string>();

  for (const candidate of value.links) {
    const link = parseLink(candidate, nodeIds);

    if (
      link == null ||
      linkIds.has(link.id) ||
      linkRejection(links, link.source, link.target) != null
    ) {
      return null;
    }

    linkIds.add(link.id);
    links.push(link);
  }

  const operationSpec =
    value.operationSpec == null ? null : parseGovDataOperationSpec(value.operationSpec);
  const requestData = value.requestData == null ? null : parseJsonObject(value.requestData);
  const payloadSchema = value.payloadSchema == null ? null : parseJsonObject(value.payloadSchema);

  if (
    (value.operationSpec != null && operationSpec == null) ||
    (value.requestData != null && requestData == null) ||
    (value.payloadSchema != null && payloadSchema == null)
  ) {
    return null;
  }

  return {
    nodes,
    links,
    ...(value.operationSpec !== undefined ? { operationSpec } : {}),
    ...(requestData == null ? {} : { requestData }),
    ...(value.payloadSchema !== undefined ? { payloadSchema } : {}),
  };
}

/**
 * The pipe is serial, so a link that lets a node reach itself again is refused
 * at the canvas rather than at save time. Returns why the link is impossible so
 * the canvas can show it while the user is still dragging.
 */
export function linkRejection(
  links: readonly WorkflowLink[],
  source: string,
  target: string,
): "self" | "duplicate" | "cycle" | null {
  if (source === target) {
    return "self";
  }

  if (links.some((link) => link.source === source && link.target === target)) {
    return "duplicate";
  }

  const visited = new Set<string>();
  const queue = [target];

  while (queue.length > 0) {
    const current = queue.pop();

    if (current === source) {
      return "cycle";
    }

    if (current == null || visited.has(current)) {
      continue;
    }

    visited.add(current);

    for (const link of links) {
      if (link.source === current) {
        queue.push(link.target);
      }
    }
  }

  return null;
}
