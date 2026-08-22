"use client";

import { Badge, Button, Input, SideNavigation, Skeleton } from "@mobydick/design-system";
import {
  AffiliateFilledIcon,
  ChevronLeftIcon,
  DatabaseFilledIcon,
  PanelLeftFilledIcon,
  PencilIcon,
  PlayFilledIcon,
  SendFilledIcon,
  SitemapFilledIcon,
  TransformFilledIcon,
} from "@mobydick/icon";
import Link from "next/link";
import { useState } from "react";
import { graphql, useMutation } from "react-relay";
import { match } from "ts-pattern";
import type { projectNavigationRenameMutation } from "@/__generated__/relay/projectNavigationRenameMutation.graphql";
import { useWorkflow, type CanvasNodeKind } from "./workflow-store";

const RenameProject = graphql`
  mutation projectNavigationRenameMutation($input: RenameProjectInput!) {
    renameProject(input: $input) {
      id
      name
      updatedAt
    }
  }
`;

const PALETTE: ReadonlyArray<{
  kind: CanvasNodeKind;
  label: string;
  Icon: typeof DatabaseFilledIcon;
}> = [
  { kind: "SOURCE", label: "데이터 소스", Icon: DatabaseFilledIcon },
  { kind: "TRANSFORM", label: "변환", Icon: TransformFilledIcon },
  { kind: "JOIN", label: "조인", Icon: AffiliateFilledIcon },
  { kind: "OUTPUT", label: "출력", Icon: SendFilledIcon },
];

function phaseBadge(phase: string) {
  return match(phase)
    .with("DISCOVER", () => ({ label: "발견", tone: "informative" as const }))
    .with("COMPOSE", () => ({ label: "조립", tone: "brand" as const }))
    .with("SERVE", () => ({ label: "배포", tone: "positive" as const }))
    .otherwise(() => ({ label: "발견", tone: "neutral" as const }));
}

export interface ProjectNavigationProps {
  name: string;
  phase: string;
  projectId: string;
  question: string;
}

function ProjectName({ name, projectId }: { name: string; projectId: string }) {
  const [draft, setDraft] = useState<string | null>(null);
  const [commit, renaming] = useMutation<projectNavigationRenameMutation>(RenameProject);

  if (draft == null) {
    return (
      <button
        className="text-fg-neutral hover:text-fg-brand flex min-w-0 items-center gap-1 text-left text-sm font-semibold"
        onClick={() => setDraft(name)}
        title="이름 바꾸기"
        type="button"
      >
        <span className="truncate">{name}</span>
        <PencilIcon size={12} />
      </button>
    );
  }

  const close = () => setDraft(null);
  const submit = () => {
    const trimmed = draft.trim();

    if (trimmed === "" || trimmed === name) {
      close();
      return;
    }

    commit({ variables: { input: { id: projectId, name: trimmed } }, onCompleted: close });
  };

  return (
    <Input
      autoFocus
      disabled={renaming}
      onBlur={submit}
      onChange={(event) => setDraft(event.target.value)}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          submit();
        }

        if (event.key === "Escape") {
          close();
        }
      }}
      value={draft}
    />
  );
}

export function ProjectNavigation({ name, phase, projectId, question }: ProjectNavigationProps) {
  const { addNode, dirty, save, saving } = useWorkflow();
  const badge = phaseBadge(phase);

  return (
    <SideNavigation.Root aria-label="프로젝트 메뉴">
      <SideNavigation.Header className="flex-col items-stretch gap-1 pr-12">
        <Link
          className="text-fg-neutral-subtle hover:text-fg-neutral flex items-center gap-1 text-xs font-medium"
          href="/"
        >
          <ChevronLeftIcon size={14} />
          <span className="group-data-[side-navigation-state=collapsed]/side-navigation:opacity-0 truncate transition-opacity">
            모든 프로젝트
          </span>
        </Link>
        <div className="group-data-[side-navigation-state=collapsed]/side-navigation:opacity-0 flex min-w-0 items-center gap-2 transition-opacity">
          <ProjectName name={name} projectId={projectId} />
          <Badge emphasis="weak" size="small" tone={badge.tone}>
            {badge.label}
          </Badge>
        </div>
      </SideNavigation.Header>

      <SideNavigation.Trigger aria-label="사이드바 접기">
        <PanelLeftFilledIcon />
      </SideNavigation.Trigger>

      <SideNavigation.Content>
        <SideNavigation.Group>
          <SideNavigation.GroupLabel>질문</SideNavigation.GroupLabel>
          <p className="group-data-[side-navigation-state=collapsed]/side-navigation:opacity-0 text-fg-neutral-muted px-2 text-xs leading-relaxed transition-opacity">
            {question}
          </p>
        </SideNavigation.Group>

        <SideNavigation.Group>
          <SideNavigation.GroupLabel>노드 추가</SideNavigation.GroupLabel>
          {PALETTE.map(({ Icon, kind, label }) => (
            <SideNavigation.Item
              key={kind}
              onClick={() => addNode(kind)}
              title={label}
            >
              <SideNavigation.ItemPrefixIcon svg={<Icon size={20} />} />
              <SideNavigation.ItemLabel>{label}</SideNavigation.ItemLabel>
            </SideNavigation.Item>
          ))}
        </SideNavigation.Group>

        <SideNavigation.Group>
          <SideNavigation.GroupLabel>단계</SideNavigation.GroupLabel>
          <SideNavigation.Item current title="캔버스">
            <SideNavigation.ItemPrefixIcon svg={<SitemapFilledIcon size={20} />} />
            <SideNavigation.ItemLabel>캔버스</SideNavigation.ItemLabel>
          </SideNavigation.Item>
          <SideNavigation.Item disabled title="실행은 아직 준비 중이에요">
            <SideNavigation.ItemPrefixIcon svg={<PlayFilledIcon size={20} />} />
            <SideNavigation.ItemLabel>실행</SideNavigation.ItemLabel>
          </SideNavigation.Item>
          <SideNavigation.Item disabled title="배포는 아직 준비 중이에요">
            <SideNavigation.ItemPrefixIcon svg={<SendFilledIcon size={20} />} />
            <SideNavigation.ItemLabel>배포</SideNavigation.ItemLabel>
          </SideNavigation.Item>
        </SideNavigation.Group>
      </SideNavigation.Content>

      <SideNavigation.Footer>
        <Button
          className="w-full group-data-[side-navigation-state=collapsed]/side-navigation:aspect-square group-data-[side-navigation-state=collapsed]/side-navigation:px-0"
          disabled={!dirty || saving}
          onClick={save}
          size="small"
          variant={dirty ? "brandSolid" : "neutralWeak"}
        >
          <span className="group-data-[side-navigation-state=collapsed]/side-navigation:hidden">
            {match({ dirty, saving })
              .with({ saving: true }, () => "저장 중")
              .with({ dirty: true }, () => "저장")
              .otherwise(() => "저장됨")}
          </span>
        </Button>
      </SideNavigation.Footer>
    </SideNavigation.Root>
  );
}

export function ProjectNavigationSkeleton() {
  return (
    <SideNavigation.Root aria-label="프로젝트 메뉴">
      <SideNavigation.Header className="flex-col items-stretch gap-2">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-4 w-32" />
      </SideNavigation.Header>
      <SideNavigation.Content>
        <Skeleton className="h-10 w-full" radius="control" />
        <Skeleton className="h-10 w-full" radius="control" />
        <Skeleton className="h-10 w-full" radius="control" />
      </SideNavigation.Content>
    </SideNavigation.Root>
  );
}
