"use client";

import { Badge, Button, Callout, Card, Skeleton, Textarea } from "@mobydick/design-system";
import { ArrowRightIcon, SparkleFilledIcon, TrashIcon } from "@mobydick/icon";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { graphql, useLazyLoadQuery, useMutation } from "react-relay";
import { match } from "ts-pattern";
import type { projectPickerCreateMutation } from "@/__generated__/relay/projectPickerCreateMutation.graphql";
import type { projectPickerDeleteMutation } from "@/__generated__/relay/projectPickerDeleteMutation.graphql";
import type { projectPickerQuery } from "@/__generated__/relay/projectPickerQuery.graphql";
import { ClientQuery } from "@/relay/client-query";

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

const CreateProject = graphql`
  mutation projectPickerCreateMutation($input: CreateProjectInput!) {
    createProject(input: $input) {
      id
      name
      question
      phase
      updatedAt
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

function ProjectCreateForm() {
  const router = useRouter();
  const [question, setQuestion] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [create, creating] = useMutation<projectPickerCreateMutation>(CreateProject);

  const trimmed = question.trim();

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();

        if (trimmed === "" || creating) {
          return;
        }

        setError(null);
        create({
          variables: { input: { question: trimmed, name: null } },
          onCompleted: (response, errors) => {
            if (errors != null && errors.length > 0) {
              setError(errors[0]?.message ?? "프로젝트를 만들지 못했어요.");
              return;
            }

            router.push(`/projects/${response.createProject.id}`);
          },
          onError: (reason) => setError(reason.message),
        });
      }}
    >
      <Textarea
        aria-label="질문"
        className="min-h-28 text-base"
        name="question"
        onChange={(event) => setQuestion(event.target.value)}
        placeholder="경북에서 생활폐기물이 인구 대비 많은 시군이 어디야?"
        value={question}
      />
      <div className="flex items-center justify-between gap-3">
        <p className="text-fg-neutral-subtle text-xs">질문 하나가 프로젝트 하나예요.</p>
        <Button disabled={trimmed === "" || creating} size="large" type="submit">
          <SparkleFilledIcon />
          {creating ? "만드는 중" : "작업실 열기"}
        </Button>
      </div>
      {error != null && (
        <Callout tone="critical">
          <Callout.Content>
            <Callout.Title>프로젝트를 만들지 못했어요</Callout.Title>
            <Callout.Description>{error}</Callout.Description>
          </Callout.Content>
        </Callout>
      )}
    </form>
  );
}

function ProjectGrid() {
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
              위에 질문을 하나 쓰면 그 질문을 담은 작업실이 열려요.
            </Card.Description>
          </Card.Header>
        </Card>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => {
            const phase = phaseLabel(project.phase);

            return (
              <li key={project.id}>
                <Card className="group/card hover:border-stroke-neutral-muted h-full transition-colors">
                  <Card.Header>
                    <div className="flex items-start justify-between gap-2">
                      <Card.Title className="text-base">{project.name}</Card.Title>
                      <Badge emphasis="weak" size="small" tone={phase.tone}>
                        {phase.label}
                      </Badge>
                    </div>
                    <Card.Description className="line-clamp-2">{project.question}</Card.Description>
                  </Card.Header>
                  <Card.Body className="flex items-center justify-between gap-2">
                    <span className="text-fg-neutral-subtle text-xs">
                      {relativeTime(project.updatedAt)}
                    </span>
                    <div className="flex items-center gap-1">
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
                  </Card.Body>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function ProjectGridSkeleton() {
  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {[0, 1, 2].map((key) => (
        <li key={key}>
          <Skeleton className="h-36 w-full" radius="surface" />
        </li>
      ))}
    </ul>
  );
}

export function ProjectPicker() {
  return (
    <div className="flex flex-col gap-10">
      <ProjectCreateForm />
      <section className="flex flex-col gap-4">
        <h2 className="text-fg-neutral text-lg font-semibold">이어서 열기</h2>
        <ClientQuery fallback={<ProjectGridSkeleton />}>
          <ProjectGrid />
        </ClientQuery>
      </section>
    </div>
  );
}
