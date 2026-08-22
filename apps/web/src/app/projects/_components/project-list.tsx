"use client";

import { deriveProjectPhase } from "@mobydick/domain";
import { Badge, Button, Callout, Card, Skeleton } from "@mobydick/design-system";
import Link from "next/link";
import { describePhase } from "../../../lib/project-phase";
import { useProjects } from "../../../lib/use-projects";

export function ProjectList() {
  const { dropped, error, projects, replace } = useProjects();

  if (projects == null) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-24 w-full" radius="surface" />
        <Skeleton className="h-24 w-full" radius="surface" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {error === "unavailable" && (
        <Callout tone="critical">
          <Callout.Content>
            <Callout.Title>프로젝트를 저장할 수 없어요</Callout.Title>
            <Callout.Description>
              이 브라우저가 로컬 저장소를 막고 있어요. 시크릿 창이나 저장소 차단 설정을 확인해요.
            </Callout.Description>
          </Callout.Content>
        </Callout>
      )}
      {error === "quota" && (
        <Callout tone="critical">
          <Callout.Content>
            <Callout.Title>저장 공간이 가득 찼어요</Callout.Title>
            <Callout.Description>
              쓰지 않는 프로젝트를 지우면 다시 저장할 수 있어요.
            </Callout.Description>
          </Callout.Content>
        </Callout>
      )}
      {error === "corrupt" && (
        <Callout tone="warning">
          <Callout.Content>
            <Callout.Title>저장된 프로젝트를 읽지 못했어요</Callout.Title>
            <Callout.Description>형식이 깨져서 목록을 비웠어요.</Callout.Description>
          </Callout.Content>
        </Callout>
      )}
      {dropped > 0 && (
        <Callout tone="warning">
          <Callout.Content>
            <Callout.Title>{dropped}개를 목록에서 뺐어요</Callout.Title>
            <Callout.Description>형식에 맞지 않아 읽을 수 없었어요.</Callout.Description>
          </Callout.Content>
        </Callout>
      )}

      {projects.length === 0 ? (
        <Card>
          <Card.Header>
            <Card.Title>아직 프로젝트가 없어요</Card.Title>
            <Card.Description>
              답을 알고 싶은 질문을 쓰면 그 질문에 맞는 데이터를 찾아줘요.
            </Card.Description>
          </Card.Header>
          <Card.Body>
            <Button asChild>
              <Link href="/projects/new">첫 프로젝트 만들기</Link>
            </Button>
          </Card.Body>
        </Card>
      ) : (
        projects.map((project) => {
          const phase = describePhase(deriveProjectPhase(project));

          return (
            <Card key={project.id}>
              <Card.Header>
                <div className="flex items-start justify-between gap-3">
                  <Card.Title>
                    <Link
                      className="rounded-control hover:underline"
                      href={`/projects/${project.id}`}
                    >
                      {project.name}
                    </Link>
                  </Card.Title>
                  <Badge tone={phase.tone}>{phase.label}</Badge>
                </div>
                <Card.Description>{project.question}</Card.Description>
              </Card.Header>
              <Card.Footer className="justify-between">
                <span className="text-fg-neutral-subtle text-xs">
                  {new Date(project.updatedAt).toLocaleString("ko-KR")}
                </span>
                <Button
                  onClick={() => replace(projects.filter(({ id }) => id !== project.id))}
                  size="small"
                  variant="ghost"
                >
                  지우기
                </Button>
              </Card.Footer>
            </Card>
          );
        })
      )}
    </div>
  );
}
