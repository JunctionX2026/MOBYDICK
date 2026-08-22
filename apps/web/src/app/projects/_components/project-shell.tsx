"use client";

import { deriveProjectPhase, touchProject, type Project } from "@mobydick/domain";
import { Badge, Button, Callout, Input, Skeleton, cn } from "@mobydick/design-system";
import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { PROJECT_PHASES, describePhase } from "../../../lib/project-phase";
import { useProjects } from "../../../lib/use-projects";

export function ProjectShell({ children }: { children: ReactNode }) {
  const params = useParams<{ id: string }>();
  const pathname = usePathname();
  const { projects, replace } = useProjects();
  const [draftName, setDraftName] = useState<string | null>(null);

  if (projects == null) {
    return (
      <div className="mx-auto flex max-w-5xl flex-col gap-6 px-6 py-12">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-10 w-80" radius="surface" />
      </div>
    );
  }

  const project = projects.find(({ id }) => id === params.id);

  if (project == null) {
    return (
      <div className="mx-auto flex max-w-5xl flex-col gap-4 px-6 py-12">
        <Callout tone="critical">
          <Callout.Content>
            <Callout.Title>이 프로젝트를 찾을 수 없어요</Callout.Title>
            <Callout.Description>
              지웠거나, 프로젝트를 만든 브라우저가 아니에요. 프로젝트는 브라우저를 따라가지 않아요.
            </Callout.Description>
          </Callout.Content>
        </Callout>
        <div>
          <Button asChild>
            <Link href="/projects">프로젝트 목록으로</Link>
          </Button>
        </div>
      </div>
    );
  }

  const phase = describePhase(deriveProjectPhase(project));

  const rename = (next: Project, name: string) => {
    if (name.trim() === "") {
      setDraftName(null);
      return;
    }

    replace([...projects.filter(({ id }) => id !== next.id), touchProject(next, { name })]);
    setDraftName(null);
  };

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 px-6 py-12">
      <header className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <Badge tone={phase.tone}>{phase.label}</Badge>
          <Link className="text-fg-neutral-subtle text-xs hover:underline" href="/projects">
            프로젝트 목록
          </Link>
        </div>

        {draftName == null ? (
          <div className="flex items-center gap-2">
            <h1 className="text-fg-neutral text-2xl font-bold tracking-tight">{project.name}</h1>
            <Button onClick={() => setDraftName(project.name)} size="small" variant="ghost">
              이름 바꾸기
            </Button>
          </div>
        ) : (
          <form
            className="flex items-center gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              rename(project, draftName);
            }}
          >
            <Input
              aria-label="프로젝트 이름"
              autoFocus
              className="max-w-sm"
              onChange={(event) => setDraftName(event.target.value)}
              value={draftName}
            />
            <Button size="small" type="submit">
              저장
            </Button>
            <Button onClick={() => setDraftName(null)} size="small" variant="ghost">
              취소
            </Button>
          </form>
        )}

        <p className="text-fg-neutral-muted max-w-2xl text-sm">{project.question}</p>

        <nav aria-label="단계" className="flex gap-1 pt-1">
          {PROJECT_PHASES.map((value) => {
            const href = `/projects/${project.id}/${value}` as const;
            const { label } = describePhase(value);

            return (
              <Link
                aria-current={pathname === href ? "page" : undefined}
                className={cn(
                  "rounded-control px-3 py-1.5 text-sm font-medium",
                  "text-fg-neutral-muted hover:bg-bg-transparent-pressed",
                  "aria-[current]:bg-bg-transparent-selected aria-[current]:text-fg-neutral",
                )}
                href={href}
                key={value}
              >
                {label}
              </Link>
            );
          })}
        </nav>
      </header>

      {children}
    </div>
  );
}
