"use client";

import { Button, Input, SideNavigation, Skeleton, Spinner } from "@mobydick/design-system";
import {
  AffiliateFilledIcon,
  ChevronLeftIcon,
  DatabaseFilledIcon,
  DeviceFloppyFilledIcon,
  PanelLeftFilledIcon,
  PencilIcon,
  SendFilledIcon,
  SitemapFilledIcon,
  TransformFilledIcon,
} from "@mobydick/icon";
import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { graphql, useMutation } from "react-relay";
import { match } from "ts-pattern";
import type { projectNavigationRenameMutation } from "@/__generated__/relay/projectNavigationRenameMutation.graphql";
import { ConnectDialog, NodeDialog, WorkflowDialog, type NodeDialogOption } from "./workflow-dialog";
import { DataSourceDialog, type RecommendedDataset } from "./data-source-dialog";
import { useWorkflow } from "./workflow-store";

const RenameProject = graphql`
  mutation projectNavigationRenameMutation($input: RenameProjectInput!) {
    renameProject(input: $input) {
      id
      name
      updatedAt
    }
  }
`;

const NODE_OPTIONS: readonly NodeDialogOption[] = [
  { kind: "SOURCE", label: "데이터 소스", icon: <DatabaseFilledIcon size={20} /> },
  { kind: "TRANSFORM", label: "변환", icon: <TransformFilledIcon size={20} /> },
  { kind: "JOIN", label: "조인", icon: <AffiliateFilledIcon size={20} /> },
  { kind: "OUTPUT", label: "출력", icon: <SendFilledIcon size={20} /> },
];

const sideNavigationCardClassName =
  "m-4 h-[calc(100%-2rem)] rounded-surface border border-stroke-neutral-subtle shadow-elevation-raised";

export interface ProjectNavigationProps {
  name: string;
  projectId: string;
  question: string;
}

interface ProjectSettingsDialogProps {
  name: string;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  projectId: string;
}

function ProjectSettingsDialog({ name, onOpenChange, open, projectId }: ProjectSettingsDialogProps) {
  const [draft, setDraft] = useState(name);
  const [error, setError] = useState<string | null>(null);
  const [commit, renaming] = useMutation<projectNavigationRenameMutation>(RenameProject);

  useEffect(() => {
    if (open) {
      setDraft(name);
      setError(null);
    }
  }, [name, open]);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = draft.trim();

    if (trimmed === "") {
      setError("프로젝트 이름을 입력하세요.");
      return;
    }

    if (trimmed === name) {
      onOpenChange(false);
      return;
    }

    setError(null);
    commit({
      variables: { input: { id: projectId, name: trimmed } },
      onCompleted: (_response, errors) => {
        if (errors != null && errors.length > 0) {
          setError(errors[0]?.message ?? "프로젝트 이름을 바꾸지 못했어요.");
          return;
        }

        onOpenChange(false);
      },
      onError: (reason) => setError(reason.message),
    });
  };

  return (
    <WorkflowDialog
      description="프로젝트 이름을 바꾸거나 실행 설정을 확인해요."
      id="project-settings-dialog"
      onOpenChange={onOpenChange}
      open={open}
      title="프로젝트 설정"
    >
      <form className="flex flex-col gap-5" onSubmit={submit}>
        <label className="flex flex-col gap-1.5">
          <span className="text-fg-neutral text-sm font-medium">프로젝트 이름</span>
          <Input
            autoFocus
            disabled={renaming}
            onChange={(event) => setDraft(event.target.value)}
            value={draft}
          />
        </label>
        {error != null && <p className="text-fg-critical text-sm">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button onClick={() => onOpenChange(false)} size="small" variant="ghost">
            취소
          </Button>
          <Button disabled={renaming} size="small" type="submit">
            {renaming && <Spinner aria-hidden label="" size="small" variant="current" />}
            저장
          </Button>
        </div>
      </form>
    </WorkflowDialog>
  );
}

export function ProjectNavigation({ name, projectId, question }: ProjectNavigationProps) {
  const { addNode, connect, dirty, nodes, rejectionFor, save, saving } = useWorkflow();
  const [nodeDialogOpen, setNodeDialogOpen] = useState(false);
  const [connectDialogOpen, setConnectDialogOpen] = useState(false);
  const [dataSourceDialogOpen, setDataSourceDialogOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const handleAddNode = (kind: typeof NODE_OPTIONS[number]["kind"]) => {
    if (kind === "SOURCE") {
      setDataSourceDialogOpen(true);
      return;
    }

    addNode(kind);
  };

  return (
    <>
      <SideNavigation.Root aria-label="프로젝트 메뉴" className={sideNavigationCardClassName}>
        <SideNavigation.Header className="pr-12">
          <Link
            className="text-fg-neutral-subtle hover:text-fg-neutral flex items-center gap-1 text-xs font-medium"
            href="/"
          >
            <ChevronLeftIcon size={14} />
            <span className="group-data-[side-navigation-state=collapsed]/side-navigation:opacity-0 truncate transition-opacity">
              모든 프로젝트
            </span>
          </Link>
        </SideNavigation.Header>

        <SideNavigation.Trigger aria-label="사이드바 접기">
          <PanelLeftFilledIcon />
        </SideNavigation.Trigger>

        <SideNavigation.Content>
          <SideNavigation.Group>
            <SideNavigation.GroupLabel>도구</SideNavigation.GroupLabel>
            <SideNavigation.Item
              onClick={() => setNodeDialogOpen(true)}
              title="노드 추가"
            >
              <SideNavigation.ItemPrefixIcon svg={<SitemapFilledIcon size={20} />} />
              <SideNavigation.ItemLabel>노드 추가</SideNavigation.ItemLabel>
            </SideNavigation.Item>
            <SideNavigation.Item
              onClick={() => setConnectDialogOpen(true)}
              title="연결"
            >
              <SideNavigation.ItemPrefixIcon svg={<AffiliateFilledIcon size={20} />} />
              <SideNavigation.ItemLabel>연결</SideNavigation.ItemLabel>
            </SideNavigation.Item>
          </SideNavigation.Group>

          <SideNavigation.Group>
            <SideNavigation.GroupLabel>단계</SideNavigation.GroupLabel>
            <SideNavigation.Item current title="캔버스">
              <SideNavigation.ItemPrefixIcon svg={<SitemapFilledIcon size={20} />} />
              <SideNavigation.ItemLabel>캔버스</SideNavigation.ItemLabel>
            </SideNavigation.Item>
          </SideNavigation.Group>
        </SideNavigation.Content>

        <SideNavigation.Footer>
          <SideNavigation.Item onClick={() => setSettingsOpen(true)} title="프로젝트 설정">
            <SideNavigation.ItemPrefixIcon svg={<PencilIcon size={20} />} />
            <SideNavigation.ItemLabel>프로젝트 설정</SideNavigation.ItemLabel>
          </SideNavigation.Item>
          <SideNavigation.Item
            disabled={!dirty || saving}
            onClick={save}
            title={match({ dirty, saving })
              .with({ saving: true }, () => "저장 중")
              .with({ dirty: true }, () => "저장")
              .otherwise(() => "저장됨")}
          >
            <SideNavigation.ItemPrefixIcon svg={<DeviceFloppyFilledIcon size={20} />} />
            <SideNavigation.ItemLabel>
              {match({ dirty, saving })
                .with({ saving: true }, () => "저장 중")
                .with({ dirty: true }, () => "저장")
                .otherwise(() => "저장됨")}
            </SideNavigation.ItemLabel>
          </SideNavigation.Item>
        </SideNavigation.Footer>
      </SideNavigation.Root>

      <NodeDialog
        onAddNode={handleAddNode}
        onOpenChange={setNodeDialogOpen}
        open={nodeDialogOpen}
        options={NODE_OPTIONS}
      />
      <DataSourceDialog
        onOpenChange={setDataSourceDialogOpen}
        onSelect={(dataset: RecommendedDataset) =>
          addNode("SOURCE", {
            datasetId: dataset.datasetId,
            subtitle: dataset.operation || dataset.provider,
            title: dataset.title,
          })
        }
        open={dataSourceDialogOpen}
        question={question}
      />
      <ConnectDialog
        nodes={nodes}
        onConnect={(source, target) => {
          if (rejectionFor(source, target) == null) {
            connect(source, target);
          }
        }}
        onOpenChange={setConnectDialogOpen}
        open={connectDialogOpen}
        rejectionFor={rejectionFor}
      />
      <ProjectSettingsDialog
        name={name}
        onOpenChange={setSettingsOpen}
        open={settingsOpen}
        projectId={projectId}
      />
    </>
  );
}

function NavigationGroupLabelSkeleton({ width }: { width: string }) {
  return (
    <div className="flex h-8 shrink-0 items-center px-2">
      <Skeleton className={`h-3 ${width}`} />
    </div>
  );
}

function NavigationItemSkeleton({ width }: { width: string }) {
  return (
    <div className="relative flex h-10 w-full shrink-0 items-center overflow-hidden rounded-control px-2">
      <Skeleton className="absolute top-1/2 left-2 size-5 -translate-y-1/2" radius="full" />
      <Skeleton className={`ml-7 h-4 ${width}`} />
    </div>
  );
}

export function ProjectNavigationSkeleton() {
  return (
    <SideNavigation.Root
      aria-busy="true"
      aria-label="프로젝트 메뉴를 불러오는 중"
      className={sideNavigationCardClassName}
    >
      <SideNavigation.Header className="pr-12">
        <div className="flex h-4 items-center gap-1">
          <Skeleton className="size-3" radius="full" />
          <Skeleton className="h-3 w-20" />
        </div>
      </SideNavigation.Header>
      <Skeleton className="absolute top-2 right-2 size-9" radius="control" />
      <SideNavigation.Content>
        <SideNavigation.Group>
          <NavigationGroupLabelSkeleton width="w-8" />
          <NavigationItemSkeleton width="w-20" />
          <NavigationItemSkeleton width="w-12" />
        </SideNavigation.Group>
        <SideNavigation.Group>
          <NavigationGroupLabelSkeleton width="w-8" />
          <NavigationItemSkeleton width="w-14" />
        </SideNavigation.Group>
      </SideNavigation.Content>
      <SideNavigation.Footer>
        <NavigationItemSkeleton width="w-20" />
        <NavigationItemSkeleton width="w-12" />
      </SideNavigation.Footer>
    </SideNavigation.Root>
  );
}
