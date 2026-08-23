"use client";

import { Button, SideNavigation, Skeleton } from "@mobydick/design-system";
import {
  AffiliateFilledIcon,
  DatabaseFilledIcon,
  DeviceFloppyFilledIcon,
  ExternalLinkIcon,
  MobydickMarkIcon,
  PanelLeftFilledIcon,
  PencilIcon,
  SendFilledIcon,
  SitemapFilledIcon,
} from "@mobydick/icon";
import Link from "next/link";
import type { Route } from "next";
import { useState } from "react";
import { match } from "ts-pattern";
import { ConnectDialog, NodeDialog, type NodeDialogOption } from "./workflow-dialog";
import { DataSourceDialog, type RecommendedDataset } from "./data-source-dialog";
import { LiveDataDialog } from "./live-data-dialog";
import { useWorkflow } from "./workflow-store";
import type { GovDataOperationSpec } from "@mobydick/domain";

const NODE_OPTIONS: readonly NodeDialogOption[] = [
  { kind: "SOURCE", label: "데이터 소스", icon: <DatabaseFilledIcon size={20} /> },
  { kind: "OPERATION", label: "조인·변환", icon: <AffiliateFilledIcon size={20} /> },
  { kind: "OUTPUT", label: "출력", icon: <SendFilledIcon size={20} /> },
];

const sideNavigationCardClassName =
  "m-4 h-[calc(100%-2rem)] rounded-surface border border-stroke-neutral-subtle shadow-elevation-raised";

export interface ProjectNavigationProps {
  name: string;
  projectId: string;
  question: string;
}

export function ProjectNavigation({ projectId, question }: ProjectNavigationProps) {
  const { addNode, connect, dirty, nodes, rejectionFor, save, saving } = useWorkflow();
  const [nodeDialogOpen, setNodeDialogOpen] = useState(false);
  const [connectDialogOpen, setConnectDialogOpen] = useState(false);
  const [dataSourceDialogOpen, setDataSourceDialogOpen] = useState(false);
  const [liveDataDialogOpen, setLiveDataDialogOpen] = useState(false);

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
            aria-label="모든 프로젝트"
            className="text-fg-neutral-subtle hover:text-fg-neutral flex items-center gap-2 text-xs font-medium"
            href="/"
            onClick={(event) => {
              if (dirty && !saving && !window.confirm("저장하지 않은 변경 사항이 있어요. 페이지를 나갈까요?")) {
                event.preventDefault();
              }
            }}
            title="모든 프로젝트"
          >
            <MobydickMarkIcon size={20} />
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
            <SideNavigation.Item
              onClick={() => setLiveDataDialogOpen(true)}
              title="실시간 API 호출"
            >
              <SideNavigation.ItemPrefixIcon svg={<ExternalLinkIcon size={20} />} />
              <SideNavigation.ItemLabel>실시간 호출</SideNavigation.ItemLabel>
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
          <SideNavigation.Item asChild title="프로젝트 설정">
            <Link
              href={`/projects/${projectId}/settings` as Route}
              onClick={(event) => {
                if (dirty && !saving && !window.confirm("저장하지 않은 변경 사항이 있어요. 페이지를 나갈까요?")) {
                  event.preventDefault();
                }
              }}
            >
              <SideNavigation.ItemPrefixIcon svg={<PencilIcon size={20} />} />
              <SideNavigation.ItemLabel>프로젝트 설정</SideNavigation.ItemLabel>
            </Link>
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
      <LiveDataDialog onOpenChange={setLiveDataDialogOpen} open={liveDataDialogOpen} />
      <ConnectDialog
        nodes={nodes}
        onConnect={(source, target, intent, spec: GovDataOperationSpec) => {
          if (rejectionFor(source, target) == null) {
            connect(source, target, intent, spec);
          }
        }}
        onOpenChange={setConnectDialogOpen}
        open={connectDialogOpen}
        question={question}
        rejectionFor={rejectionFor}
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
