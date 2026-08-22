import { isUlid, ulid } from "./ulid";

export type ProjectId = string;

export type ProjectPhase = "discover" | "compose" | "serve";

/**
 * The full shape belongs to specs/features/011-seam-workflow-to-deployment.md.
 * A project only needs to know whether the canvas has anything in it.
 */
export interface WorkflowNode {
  id: string;
}

export interface WorkflowLink {
  id: string;
}

export interface Workflow {
  nodes: WorkflowNode[];
  links: WorkflowLink[];
}

export interface Project {
  id: ProjectId;
  name: string;
  question: string;
  workflow: Workflow;
  deploymentId: string | null;
  createdAt: string;
  updatedAt: string;
}

const NAME_MAX_LENGTH = 40;

export function projectNameFromQuestion(question: string) {
  const collapsed = question.trim().replace(/\s+/g, " ");

  return collapsed.length > NAME_MAX_LENGTH
    ? `${collapsed.slice(0, NAME_MAX_LENGTH).trimEnd()}…`
    : collapsed;
}

export function createProject({
  id = ulid(),
  name,
  now = new Date(),
  question,
}: {
  id?: ProjectId;
  name?: string;
  now?: Date;
  question: string;
}): Project {
  const trimmed = question.trim();

  if (trimmed === "") {
    throw new Error("A project needs a question.");
  }

  const timestamp = now.toISOString();

  return {
    id,
    name: name?.trim() || projectNameFromQuestion(trimmed),
    question: trimmed,
    workflow: { nodes: [], links: [] },
    deploymentId: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export function deriveProjectPhase(project: Project): ProjectPhase {
  if (project.deploymentId != null) {
    return "serve";
  }

  return project.workflow.nodes.length > 0 ? "compose" : "discover";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim() !== "";
}

function isTimestamp(value: unknown): value is string {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}

function parseIdentified(value: unknown): { id: string } | null {
  return isRecord(value) && isNonEmptyString(value.id) ? { id: value.id } : null;
}

function parseWorkflow(value: unknown): Workflow | null {
  if (!isRecord(value) || !Array.isArray(value.nodes) || !Array.isArray(value.links)) {
    return null;
  }

  const nodes = value.nodes.map(parseIdentified);
  const links = value.links.map(parseIdentified);

  if (nodes.includes(null) || links.includes(null)) {
    return null;
  }

  return { nodes: nodes as WorkflowNode[], links: links as WorkflowLink[] };
}

/**
 * Local storage is outside the type system, so a stored project is validated
 * rather than asserted. Returns null so the caller can drop the entry and tell
 * the user how many were dropped.
 */
export function parseProject(value: unknown): Project | null {
  if (!isRecord(value)) {
    return null;
  }

  const { createdAt, deploymentId, id, name, question, updatedAt, workflow } = value;

  if (typeof id !== "string" || !isUlid(id)) {
    return null;
  }

  if (!isNonEmptyString(name) || !isNonEmptyString(question)) {
    return null;
  }

  if (!isTimestamp(createdAt) || !isTimestamp(updatedAt)) {
    return null;
  }

  if (deploymentId !== null && !isNonEmptyString(deploymentId)) {
    return null;
  }

  const parsedWorkflow = parseWorkflow(workflow);

  if (parsedWorkflow == null) {
    return null;
  }

  return {
    id,
    name,
    question,
    workflow: parsedWorkflow,
    deploymentId,
    createdAt,
    updatedAt,
  };
}

export function touchProject(project: Project, changes: Partial<Project>, now = new Date()): Project {
  return { ...project, ...changes, updatedAt: now.toISOString() };
}
