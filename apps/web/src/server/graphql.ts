import { parseWorkflow, type Workflow } from "@mobydick/domain";
import { buildSchema, type GraphQLSchema } from "graphql";
import { typeDefs } from "../__generated__/type-defs";
import {
  isGraphQLNodeKind,
  NODE_KIND_FROM_GRAPHQL,
  NODE_KIND_TO_GRAPHQL,
  PROJECT_PHASE_TO_GRAPHQL,
} from "../graphql/enums";
import {
  addProject,
  deriveProjectPhase,
  findProject,
  listProjects,
  removeProject,
  renameProject,
  saveWorkflow,
  StorageError,
} from "./project-repository";
import type { Project } from "@mobydick/domain";

let cached: GraphQLSchema | null = null;

export function schema(): GraphQLSchema {
  cached ??= buildSchema(typeDefs);
  return cached;
}

interface WorkflowNodeInput {
  id: string;
  kind: string;
  title: string;
  subtitle: string | null;
  position: { x: number; y: number };
}

interface WorkflowLinkInput {
  id: string;
  source: string;
  target: string;
}

/**
 * Enum names travel in SCREAMING_CASE while the domain keeps them lowercase.
 * The mapping lives here so nothing else has to know both spellings.
 */
function toDomainWorkflow(input: {
  nodes: WorkflowNodeInput[];
  links: WorkflowLinkInput[];
}): Workflow {
  const workflow = parseWorkflow({
    nodes: input.nodes.map((node) => ({
      ...node,
      kind: isGraphQLNodeKind(node.kind) ? NODE_KIND_FROM_GRAPHQL[node.kind] : node.kind,
    })),
    links: input.links,
  });

  if (workflow == null) {
    throw new StorageError("The workflow does not match the canvas contract.");
  }

  return workflow;
}

function present(project: Project) {
  return {
    id: project.id,
    name: project.name,
    question: project.question,
    phase: PROJECT_PHASE_TO_GRAPHQL[deriveProjectPhase(project)],
    workflow: {
      nodes: project.workflow.nodes.map((node) => ({
        ...node,
        kind: NODE_KIND_TO_GRAPHQL[node.kind],
      })),
      links: project.workflow.links,
    },
    deploymentId: project.deploymentId,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
  };
}

export const rootValue = {
  projectList: async () => {
    const { droppedCount, projects } = await listProjects();
    return { droppedCount, projects: projects.map(present) };
  },
  project: async ({ id }: { id: string }) => {
    const project = await findProject(id);
    return project == null ? null : present(project);
  },
  createProject: async ({ input }: { input: { question: string; name: string | null } }) =>
    present(await addProject(input)),
  renameProject: async ({ input }: { input: { id: string; name: string } }) =>
    present(await renameProject(input.id, input.name)),
  saveWorkflow: async ({
    input,
  }: {
    input: { id: string; nodes: WorkflowNodeInput[]; links: WorkflowLinkInput[] };
  }) => present(await saveWorkflow(input.id, toDomainWorkflow(input))),
  deleteProject: async ({ id }: { id: string }) => ({
    deletedProjectId: await removeProject(id),
  }),
};
