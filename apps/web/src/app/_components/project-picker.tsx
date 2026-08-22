"use client";

import { Badge, Button, Callout, Card, Skeleton } from "@mobydick/design-system";
import { ArrowRightIcon, SparklesFilledIcon, TrashIcon } from "@mobydick/icon";
import Link from "next/link";
import { useState } from "react";
import { graphql, useLazyLoadQuery, useMutation } from "react-relay";
import { match } from "ts-pattern";
import type { projectPickerDeleteMutation } from "@/__generated__/relay/projectPickerDeleteMutation.graphql";
import type { projectPickerQuery } from "@/__generated__/relay/projectPickerQuery.graphql";
import { ClientQuery } from "@/relay/client-query";
import { NewProjectDialog } from "./new-project-dialog";

const ProjectsQuery = graphql`
  query projectPickerQuery {
    projectList {
      droppedCount
      projects {
        id
        name
        question
        phase
        updatedAt
      }
    }
  }
`;

const DeleteProject = graphql`
  mutation projectPickerDeleteMutation($id: ID!) {
    deleteProject(id: $id) {
      deletedProjectId
    }
  }
`;

function phaseLabel(phase: string) {
  return match(phase)
    .with("DISCOVER", () => ({ label: "발견", tone: "informative" as const }))
    .with("COMPOSE", () => ({ label: "조립", tone: "brand" as const }))
    .with("SERVE", () => ({ label: "배포", tone: "positive" as const }))
    .otherwise(() => ({ label: "발견", tone: "neutral" as const }));
}

const RELATIVE = new Intl.RelativeTimeFormat("ko", { numeric: "auto" });

function relativeTime(iso: string) {
  const elapsed = Date.parse(iso) - Date.now();
  const minutes = Math.round(elapsed / 60_000);

  if (Math.abs(minutes) < 60) {
    return RELATIVE.format(minutes, "minute");
  }

  const hours = Math.round(minutes / 60);

  return Math.abs(hours) < 24 ? RELATIVE.format(hours, "hour") : RELATIVE.format(Math.round(hours / 24), "day");
}

function ProjectList() {
  const data = useLazyLoadQuery<projectPickerQuery>(ProjectsQuery, {}, { fetchPolicy: "store-and-network" });
  const [remove, removing] = useMutation<projectPickerDeleteMutation>(DeleteProject);
  const { droppedCount, projects } = data.projectList;

  return (
    <div className="flex flex-col gap-4">
      {droppedCount > 0 && (
        <Callout tone="warning">
          <Callout.Content>
            <Callout.Title>{droppedCount}개 프로젝트를 목록에서 뺐어요</Callout.Title>
            <Callout.Description>
              저장된 내용이 지금 형식과 맞지 않아요. 나머지 프로젝트는 그대로 열려요.
            </Callout.Description>
          </Callout.Content>
        </Callout>
      )}

      {projects.length === 0 ? (
        <Card className="border-dashed">
          <Card.Header>
            <Card.Title>아직 프로젝트가 없어요</Card.Title>
            <Card.Description>
              새 프로젝트를 눌러 첫 작업실을 만들어보세요.
            </Card.Description>
          </Card.Header>
        </Card>
      ) : (
        <ul className="overflow-hidden rounded-surface border border-stroke-neutral-subtle bg-bg-layer-default">
          {projects.map((project) => {
            const phase = phaseLabel(project.phase);

            return (
              <li className="border-b border-stroke-neutral-subtle last:border-b-0" key={project.id}>
                <div className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="truncate text-base font-semibold text-fg-neutral-default">{project.name}</h2>
                      <Badge emphasis="weak" size="small" tone={phase.tone}>
                        {phase.label}
                      </Badge>
                    </div>
                    <p className="mt-1 line-clamp-2 text-sm text-fg-neutral-subtle">{project.question}</p>
                    <span className="mt-2 block text-xs text-fg-neutral-subtle">{relativeTime(project.updatedAt)}</span>
                  </div>
                  <div className="flex shrink-0 items-center justify-end gap-1">
                    <Button
                      aria-label={`${project.name} 삭제`}
                      disabled={removing}
                      iconOnly
                      onClick={() =>
                        remove({
                          variables: { id: project.id },
                          updater: (store) => {
                            const list = store.getRoot().getLinkedRecord("projectList");
                            const remaining = (list?.getLinkedRecords("projects") ?? []).filter(
                              (record) => record?.getDataID() !== project.id,
                            );

                            list?.setLinkedRecords(remaining, "projects");
                          },
                        })
                      }
                      size="small"
                      variant="ghost"
                    >
                      <TrashIcon />
                    </Button>
                    <Button asChild size="small" variant="outline">
                      <Link href={`/projects/${project.id}`}>
                        열기
                        <ArrowRightIcon />
                      </Link>
                    </Button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function ProjectRowSkeleton() {
  return (
    <div aria-hidden="true" className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex items-center gap-2">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-5 w-12" radius="full" />
        </div>
        <Skeleton className="h-3 w-4/5" />
        <Skeleton className="h-3 w-14" />
      </div>
      <div className="flex items-center justify-end gap-1">
        <Skeleton className="size-8" radius="control" />
        <Skeleton className="h-8 w-14" radius="control" />
      </div>
    </div>
  );
}

function ProjectListSkeleton() {
  return (
    <ul
      aria-busy="true"
      aria-label="프로젝트를 불러오는 중"
      className="overflow-hidden rounded-surface border border-stroke-neutral-subtle bg-bg-layer-default"
    >
      {[0, 1, 2].map((key) => (
        <li className="border-b border-stroke-neutral-subtle last:border-b-0" key={key}>
          <ProjectRowSkeleton />
        </li>
      ))}
    </ul>
  );
}

export function ProjectPicker() {
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Button
          aria-controls="new-project-dialog"
          aria-haspopup="dialog"
          onClick={() => setDialogOpen(true)}
          size="medium"
          type="button"
        >
          <SparklesFilledIcon />
          새 프로젝트
        </Button>
      </div>

      <NewProjectDialog onOpenChange={setDialogOpen} open={dialogOpen} />

      <ClientQuery fallback={<ProjectListSkeleton />}>
        <ProjectList />
      </ClientQuery>
    </div>
  );
}
