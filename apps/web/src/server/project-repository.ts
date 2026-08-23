import { getCloudflareContext } from "@opennextjs/cloudflare";
import {
  createProject,
  deriveProjectPhase,
  parseProject,
  serializeGovDataOperationSpec,
  touchProject,
  ulid,
  type Project,
  type ProjectId,
  type Workflow,
} from "@mobydick/domain";

export class StorageError extends Error {}

interface ProjectRow {
  id: string;
  name: string;
  question: string;
  workflow: string;
  deployment_id: string | null;
  created_at: string;
  updated_at: string;
}

interface DeploymentRow {
  id: string;
  project_id: string;
  name: string;
  question: string;
  workflow: string;
  created_at: string;
  updated_at: string;
}

export interface ProjectList {
  projects: Project[];
  droppedCount: number;
}

async function database() {
  const { env } = await getCloudflareContext({ async: true });
  const binding = env.DB;

  if (binding == null) {
    throw new StorageError("The D1 binding DB is missing.");
  }

  return binding;
}

/**
 * A row is outside the type system twice over: the column set comes from SQL
 * and the workflow column is JSON text. Both go through the domain parser
 * instead of being asserted into shape.
 */
function toProject(row: ProjectRow): Project | null {
  let workflow: unknown;

  try {
    workflow = JSON.parse(row.workflow);
  } catch {
    return null;
  }

  return parseProject({
    id: row.id,
    name: row.name,
    question: row.question,
    workflow,
    deploymentId: row.deployment_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

function storedWorkflow(workflow: Workflow) {
  return {
    ...workflow,
    ...(workflow.operationSpec == null
      ? { operationSpec: workflow.operationSpec ?? null }
      : { operationSpec: serializeGovDataOperationSpec(workflow.operationSpec) }),
  };
}

function toRow(project: Project) {
  return [
    project.id,
    project.name,
    project.question,
    JSON.stringify(storedWorkflow(project.workflow)),
    project.deploymentId,
    project.createdAt,
    project.updatedAt,
  ] as const;
}

function deploymentRow(project: Project) {
  if (project.deploymentId == null) {
    throw new StorageError("A deployment needs an id.");
  }

  return [
    project.deploymentId,
    project.id,
    project.name,
    project.question,
    JSON.stringify(storedWorkflow(project.workflow)),
    project.createdAt,
    project.updatedAt,
  ] as const;
}

function toDeploymentProject(row: DeploymentRow): Project | null {
  let workflow: unknown;

  try {
    workflow = JSON.parse(row.workflow);
  } catch {
    return null;
  }

  return parseProject({
    id: row.project_id,
    name: row.name,
    question: row.question,
    workflow,
    deploymentId: row.id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

type Database = Awaited<ReturnType<typeof database>>;

function projectStatement(db: Database, project: Project) {
  return db
    .prepare(
      `INSERT INTO projects (${SELECT_COLUMNS}) VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         name = excluded.name,
         question = excluded.question,
         workflow = excluded.workflow,
         deployment_id = excluded.deployment_id,
         updated_at = excluded.updated_at`,
    )
    .bind(...toRow(project));
}

function deploymentStatement(db: Database, project: Project) {
  return db
    .prepare(
      `INSERT INTO deployments
         (id, project_id, name, question, workflow, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         project_id = excluded.project_id,
         name = excluded.name,
         question = excluded.question,
         workflow = excluded.workflow,
         updated_at = excluded.updated_at`,
    )
    .bind(...deploymentRow(project));
}

const SELECT_COLUMNS =
  "id, name, question, workflow, deployment_id, created_at, updated_at";

export async function listProjects(): Promise<ProjectList> {
  const db = await database();
  const { results } = await db
    .prepare(`SELECT ${SELECT_COLUMNS} FROM projects ORDER BY updated_at DESC`)
    .all<ProjectRow>();

  const projects = results.map(toProject);

  return {
    projects: projects.filter((project): project is Project => project != null),
    droppedCount: projects.filter((project) => project == null).length,
  };
}

export async function findProject(id: ProjectId): Promise<Project | null> {
  const db = await database();
  const row = await db
    .prepare(`SELECT ${SELECT_COLUMNS} FROM projects WHERE id = ?`)
    .bind(id)
    .first<ProjectRow>();

  return row == null ? null : toProject(row);
}

async function requireProject(id: ProjectId): Promise<Project> {
  const project = await findProject(id);

  if (project == null) {
    throw new StorageError(`Project ${id} does not exist.`);
  }

  return project;
}

async function write(project: Project): Promise<Project> {
  const db = await database();

  await projectStatement(db, project).run();

  return project;
}

export async function addProject(input: { question: string; name?: string | null }) {
  return write(createProject({ question: input.question, name: input.name ?? undefined }));
}

export async function renameProject(id: ProjectId, name: string) {
  const trimmed = name.trim();

  if (trimmed === "") {
    throw new StorageError("A project name cannot be blank.");
  }

  return write(touchProject(await requireProject(id), { name: trimmed }));
}

export async function saveWorkflow(id: ProjectId, workflow: Workflow) {
  return write(touchProject(await requireProject(id), { workflow }));
}

export async function deployProject(id: ProjectId) {
  const project = await requireProject(id);

  if (project.workflow.operationSpec == null) {
    throw new StorageError("A project needs a saved operation spec before it can be deployed.");
  }

  const deployed = touchProject(project, { deploymentId: project.deploymentId ?? ulid() });
  const db = await database();

  await db.batch([projectStatement(db, deployed), deploymentStatement(db, deployed)]);

  return deployed;
}

export async function findProjectByDeploymentId(deploymentId: string) {
  const db = await database();
  const row = await db
    .prepare(
      `SELECT id, project_id, name, question, workflow, created_at, updated_at
       FROM deployments
       WHERE id = ?`,
    )
    .bind(deploymentId)
    .first<DeploymentRow>();

  return row == null ? null : toDeploymentProject(row);
}

export async function removeProject(id: ProjectId) {
  const db = await database();

  await db.batch([
    db.prepare("DELETE FROM deployments WHERE project_id = ?").bind(id),
    db.prepare("DELETE FROM projects WHERE id = ?").bind(id),
  ]);

  return id;
}

export { deriveProjectPhase };
