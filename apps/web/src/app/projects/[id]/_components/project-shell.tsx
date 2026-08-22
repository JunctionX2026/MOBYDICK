"use client";

import { Button, Callout, SideNavigation } from "@mobydick/design-system";
import { AlertTriangleIcon } from "@mobydick/icon";
import Link from "next/link";
import { graphql, useLazyLoadQuery } from "react-relay";
import type { projectShellQuery } from "@/__generated__/relay/projectShellQuery.graphql";
import { ClientQuery } from "@/relay/client-query";
import { Playground } from "./playground";
import { ProjectNavigation, ProjectNavigationSkeleton } from "./project-navigation";
import { toCanvasNodes, WorkflowProvider } from "./workflow-store";

const ProjectQuery = graphql`
  query projectShellQuery($id: ID!) {
    project(id: $id) {
      id
      name
      question
      phase
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

function MissingProject() {
  return (
    <div className="flex h-dvh flex-col items-center justify-center gap-4 px-6">
      <Callout tone="critical">
        <Callout.Content>
          <Callout.Title>이 프로젝트를 찾을 수 없어요</Callout.Title>
          <Callout.Description>
            주소가 바뀌었거나 프로젝트가 지워졌어요. 목록에서 다시 열어요.
          </Callout.Description>
        </Callout.Content>
      </Callout>
      <Button asChild variant="outline">
        <Link href="/">모든 프로젝트</Link>
      </Button>
    </div>
  );
}

function ProjectWorkspace({ projectId }: { projectId: string }) {
  const data = useLazyLoadQuery<projectShellQuery>(
    ProjectQuery,
    { id: projectId },
    { fetchPolicy: "store-and-network" },
  );

  if (data.project == null) {
    return <MissingProject />;
  }

  const { name, phase, question, workflow } = data.project;
  const { droppedCount, nodes } = toCanvasNodes(workflow.nodes);

  return (
    <WorkflowProvider initialLinks={workflow.links} initialNodes={nodes} projectId={projectId}>
      <div className="flex h-dvh overflow-hidden">
        <ProjectNavigation name={name} phase={phase} projectId={projectId} question={question} />
        <SideNavigation.Inset>
          {droppedCount > 0 && (
            <div className="border-stroke-neutral-subtle border-b p-3">
              <Callout tone="warning">
                <Callout.Icon>
                  <AlertTriangleIcon />
                </Callout.Icon>
                <Callout.Content>
                  <Callout.Title>노드 {droppedCount}개를 읽지 못했어요</Callout.Title>
                  <Callout.Description>
                    이 앱이 모르는 노드 종류라서 캔버스에서 빠졌어요. 저장하면 사라져요.
                  </Callout.Description>
                </Callout.Content>
              </Callout>
            </div>
          )}
          <Playground />
        </SideNavigation.Inset>
      </div>
    </WorkflowProvider>
  );
}

export function ProjectShell({ projectId }: { projectId: string }) {
  return (
    <SideNavigation.Provider>
      <ClientQuery
        fallback={
          <div className="flex h-dvh overflow-hidden">
            <ProjectNavigationSkeleton />
            <SideNavigation.Inset className="bg-bg-layer-basement" />
          </div>
        }
      >
        <ProjectWorkspace projectId={projectId} />
      </ClientQuery>
    </SideNavigation.Provider>
  );
}
