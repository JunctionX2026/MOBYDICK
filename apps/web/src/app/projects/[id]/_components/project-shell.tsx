"use client";

import { Badge, Button, Callout, SideNavigation, Skeleton, Spinner } from "@mobydick/design-system";
import { AlertTriangleIcon, HelpCircleIcon, PlayFilledIcon, SendFilledIcon } from "@mobydick/icon";
import Link from "next/link";
import { graphql, useLazyLoadQuery } from "react-relay";
import { useEffect, useRef, useState } from "react";
import { parseGovDataPlan, type GovDataPlan } from "@mobydick/domain";
import type { projectShellQuery } from "@/__generated__/relay/projectShellQuery.graphql";
import { ClientQuery } from "@/relay/client-query";
import { Playground } from "./playground";
import { ProjectNavigation, ProjectNavigationSkeleton } from "./project-navigation";
import { toCanvasNodes, useWorkflow, WorkflowProvider, type CanvasLink, type CanvasNode } from "./workflow-store";
import { DeploymentDialog } from "./workflow-dialog";

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
          datasetId
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

function phaseBadge(phase: string) {
  if (phase === "SERVE") {
    return { label: "배포", tone: "positive" as const };
  }

  if (phase === "COMPOSE") {
    return { label: "조립", tone: "brand" as const };
  }

  return { label: "발견", tone: "informative" as const };
}

function ProjectToolbar({ description, name, phase, projectId }: { description: string; name: string; phase: string; projectId: string }) {
  const [descriptionOpen, setDescriptionOpen] = useState(false);
  const [deploymentOpen, setDeploymentOpen] = useState(false);
  const badge = phaseBadge(phase);

  return (
    <header className="border-stroke-neutral-subtle bg-bg-layer-floating shadow-elevation-floating relative z-20 mx-4 mt-4 flex min-h-14 shrink-0 items-center justify-between gap-4 rounded-surface border px-4 py-2.5">
      <div className="relative flex min-w-0 flex-1 items-center gap-2">
        <h1 className="text-fg-neutral max-w-[35%] shrink-0 truncate text-sm font-semibold">{name}</h1>
        <Badge emphasis="weak" size="small" tone={badge.tone}>
          {badge.label}
        </Badge>
        <span aria-hidden className="text-fg-neutral-subtle shrink-0 text-sm">
          ·
        </span>
        <p className="text-fg-neutral-muted min-w-0 truncate text-sm">{description}</p>
        <Button
          aria-controls="project-description-tooltip"
          aria-expanded={descriptionOpen}
          aria-label="프로젝트 설명 보기"
          className="text-fg-neutral-subtle hover:text-fg-neutral"
          iconOnly
          onClick={() => setDescriptionOpen((open) => !open)}
          size="small"
          variant="ghost"
        >
          <HelpCircleIcon />
        </Button>
        {descriptionOpen && (
          <div
            className="border-stroke-neutral-subtle bg-bg-layer-modal text-fg-neutral shadow-elevation-floating absolute top-full left-0 z-30 mt-2 max-w-[min(28rem,calc(100vw-2rem))] rounded-surface border p-3 text-sm"
            id="project-description-tooltip"
            role="tooltip"
          >
            {description}
          </div>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Button
          className="h-7 gap-0.5 px-2 text-xs [&_svg]:size-3.5"
          disabled
          size="small"
          title="실행은 아직 준비 중이에요"
          variant="outline"
        >
          <PlayFilledIcon />
          실행
        </Button>
        <Button
          className="h-7 gap-0.5 px-2 text-xs [&_svg]:size-3.5"
          size="small"
          onClick={() => setDeploymentOpen(true)}
          title="API·MCP 배포 주소 만들기"
          variant="outline"
        >
          <SendFilledIcon />
          배포
        </Button>
      </div>
      <DeploymentDialog
        onOpenChange={setDeploymentOpen}
        open={deploymentOpen}
        projectId={projectId}
      />
    </header>
  );
}

function ProjectToolbarSkeleton() {
  return (
    <div className="border-stroke-neutral-subtle bg-bg-layer-floating shadow-elevation-floating relative z-20 mx-4 mt-4 flex min-h-14 shrink-0 items-center justify-between gap-4 rounded-surface border px-4 py-2.5">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-3 w-64 max-w-[40%]" />
        <Skeleton className="size-8" radius="control" />
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Skeleton className="h-7 w-14" radius="control" />
        <Skeleton className="h-7 w-14" radius="control" />
      </div>
    </div>
  );
}

function ProjectPlanner({ question, hasNodes }: { question: string; hasNodes: boolean }) {
  const { applyPipeline } = useWorkflow();
  const attempted = useRef(false);
  const [plan, setPlan] = useState<GovDataPlan | null>(null);
  const [status, setStatus] = useState<"idle" | "planning" | "ready" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (hasNodes || attempted.current) {
      return;
    }

    attempted.current = true;
    setStatus("planning");

    void fetch("/api/govdata/plan", {
      body: JSON.stringify({ query: question }),
      headers: { "content-type": "application/json" },
      method: "POST",
    })
      .then(async (response) => {
        const payload: unknown = await response.json();

        if (!response.ok) {
          throw new Error("질문을 파이프라인으로 바꾸지 못했어요.");
        }

        const parsed = parseGovDataPlan(payload);

        if (parsed == null) {
          throw new Error("계획 응답이 파이프라인 계약과 맞지 않아요.");
        }

        setPlan(parsed);
        applyPipeline(
          parsed.pipeline.nodes.map<CanvasNode>((node) => ({
            datasetId: node.datasetId,
            id: node.id,
            kind: node.kind,
            position: node.position,
            subtitle: node.subtitle,
            title: node.title,
          })),
          parsed.pipeline.links.map<CanvasLink>((link) => ({ ...link })),
        );
        setStatus("ready");
      })
      .catch((reason: unknown) => {
        setError(reason instanceof Error ? reason.message : "파이프라인을 만들지 못했어요.");
        setStatus("error");
      });
  }, [applyPipeline, hasNodes, question]);

  if (status === "idle") {
    return null;
  }

  return (
    <div className="border-stroke-neutral-subtle bg-bg-layer-floating mx-4 mt-3 rounded-surface border px-3 py-2 text-sm">
      {status === "planning" && (
        <div className="text-fg-neutral-muted flex items-center gap-2" role="status">
          <Spinner aria-hidden label="" size="small" variant="secondary" />
          설명을 분석해 데이터 소스와 파이프라인을 만드는 중이에요.
        </div>
      )}
      {status === "ready" && plan != null && (
        <details>
          <summary className="text-fg-neutral cursor-pointer font-medium">
            {plan.title} · 결과 {plan.result.rowCount.toLocaleString("ko-KR")}행
          </summary>
          <p className="text-fg-neutral-muted mt-1">{plan.explanation}</p>
          <pre className="text-fg-neutral-muted mt-2 max-h-32 overflow-auto text-xs">
            {JSON.stringify(plan.result.output ?? plan.result.rows.slice(0, 5), null, 2)}
          </pre>
        </details>
      )}
      {status === "error" && <span className="text-fg-critical">{error}</span>}
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
      <div className="bg-bg-layer-basement flex h-dvh overflow-hidden">
        <ProjectNavigation name={name} projectId={projectId} question={question} />
        <SideNavigation.Inset className="bg-bg-layer-basement">
          <ProjectToolbar description={question} name={name} phase={phase} projectId={projectId} />
          <ProjectPlanner hasNodes={nodes.length > 0} question={question} />
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
          <div className="min-h-0 flex-1">
            <Playground />
          </div>
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
          <div className="bg-bg-layer-basement flex h-dvh overflow-hidden">
            <ProjectNavigationSkeleton />
            <SideNavigation.Inset className="bg-bg-layer-basement">
              <ProjectToolbarSkeleton />
              <div className="bg-bg-layer-basement min-h-0 flex-1" />
            </SideNavigation.Inset>
          </div>
        }
      >
        <ProjectWorkspace projectId={projectId} />
      </ClientQuery>
    </SideNavigation.Provider>
  );
}
