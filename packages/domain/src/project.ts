import { isUlid, ulid } from "./ulid";
import { EMPTY_WORKFLOW, parseWorkflow, type Workflow } from "./workflow";

export type ProjectId = string;

export type ProjectPhase = "discover" | "compose" | "serve";

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
    workflow: EMPTY_WORKFLOW,
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

/**
 * Storage is outside the type system, so a stored project is validated rather
 * than asserted. Returns null so the caller can drop the entry and tell the
 * user how many were dropped.
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

  if (deploymentId != null && !isNonEmptyString(deploymentId)) {
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
    deploymentId: deploymentId ?? null,
    createdAt,
    updatedAt,
  };
}

export function touchProject(
  project: Project,
  changes: Partial<Project>,
  now = new Date(),
): Project {
  return { ...project, ...changes, updatedAt: now.toISOString() };
}
