"use client";

import { Button, Callout, Spinner } from "@mobydick/design-system";
import { TrashIcon } from "@mobydick/icon";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { match } from "ts-pattern";
import type { CanvasNode, CanvasNodeKind, LinkRejection } from "./workflow-store";

interface WorkflowDialogProps {
  children: ReactNode;
  description?: string;
  id: string;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  title: string;
}

export function WorkflowDialog({
  children,
  description,
  id,
  onOpenChange,
  open,
  title,
}: WorkflowDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const descriptionId = `${id}-description`;
  const titleId = `${id}-title`;

  useEffect(() => {
    const dialog = dialogRef.current;

    if (dialog == null) {
      return;
    }

    if (open && !dialog.open) {
      dialog.showModal();
    }

    if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  return (
    <dialog
      aria-describedby={description == null ? undefined : descriptionId}
      aria-labelledby={titleId}
      className="m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-surface border border-stroke-neutral-subtle bg-bg-layer-modal p-0 text-fg-neutral shadow-elevation-overlay backdrop:bg-bg-overlay"
      id={id}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onOpenChange(false);
        }
      }}
      onClose={() => onOpenChange(false)}
      ref={dialogRef}
    >
      <div className="flex flex-col gap-5 p-5">
        <div className="flex flex-col gap-1">
          <h2 className="text-fg-neutral text-lg font-semibold" id={titleId}>
            {title}
          </h2>
          {description != null && (
            <p className="text-fg-neutral-muted text-sm" id={descriptionId}>
              {description}
            </p>
          )}
        </div>
        {children}
      </div>
    </dialog>
  );
}

export interface NodeDialogOption {
  icon: ReactNode;
  kind: CanvasNodeKind;
  label: string;
}

export interface NodeDialogProps {
  onAddNode: (kind: CanvasNodeKind) => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  options: readonly NodeDialogOption[];
}

export function NodeDialog({ onAddNode, onOpenChange, open, options }: NodeDialogProps) {
  return (
    <WorkflowDialog
      description="추가할 노드 종류를 선택하세요."
      id="workflow-node-dialog"
      onOpenChange={onOpenChange}
      open={open}
      title="노드 추가"
    >
      <div className="flex flex-col gap-2" role="menu">
        {options.map((option) => (
          <Button
            className="justify-start"
            key={option.kind}
            onClick={() => {
              onAddNode(option.kind);
              onOpenChange(false);
            }}
            size="medium"
            variant="neutralWeak"
          >
            {option.icon}
            {option.label}
          </Button>
        ))}
      </div>
      <div className="flex justify-end">
        <Button onClick={() => onOpenChange(false)} size="small" variant="ghost">
          취소
        </Button>
      </div>
    </WorkflowDialog>
  );
}

function connectionRejectionMessage(rejection: LinkRejection) {
  return match(rejection)
    .with("self", () => "같은 노드끼리는 연결할 수 없어요.")
    .with("duplicate", () => "이미 연결되어 있어요.")
    .with("cycle", () => "파이프가 되돌아오도록 연결할 수 없어요.")
    .with(null, () => "")
    .exhaustive();
}

export interface ConnectDialogProps {
  nodes: readonly CanvasNode[];
  onConnect: (source: string, target: string) => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  rejectionFor: (source: string, target: string) => LinkRejection;
}

export function ConnectDialog({
  nodes,
  onConnect,
  onOpenChange,
  open,
  rejectionFor,
}: ConnectDialogProps) {
  const [source, setSource] = useState("");
  const [target, setTarget] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    setSource(nodes[0]?.id ?? "");
    setTarget(nodes[1]?.id ?? "");
    setError(null);
  }, [nodes, open]);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (source === "" || target === "") {
      setError("연결할 노드 두 개를 선택하세요.");
      return;
    }

    const rejection = rejectionFor(source, target);

    if (rejection != null) {
      setError(connectionRejectionMessage(rejection));
      return;
    }

    onConnect(source, target);
    onOpenChange(false);
  };

  return (
    <WorkflowDialog
      description="출발 노드와 도착 노드를 선택해 연결을 만들어요."
      id="workflow-connect-dialog"
      onOpenChange={onOpenChange}
      open={open}
      title="연결"
    >
      {nodes.length < 2 ? (
        <Callout tone="neutral">
          <Callout.Content>
            <Callout.Title>노드가 더 필요해요</Callout.Title>
            <Callout.Description>
              연결하려면 캔버스에 노드를 두 개 이상 추가하세요.
            </Callout.Description>
          </Callout.Content>
        </Callout>
      ) : (
        <form className="flex flex-col gap-5" onSubmit={submit}>
          <div className="flex flex-col gap-4">
            <label className="flex flex-col gap-1.5">
              <span className="text-fg-neutral text-sm font-medium">출발 노드</span>
              <select
                className="border-stroke-neutral-muted bg-bg-layer-default text-fg-neutral focus:border-stroke-brand-solid focus:ring-stroke-brand-solid h-10 rounded-control border px-3 text-sm outline-none focus:ring-2"
                onChange={(event) => setSource(event.target.value)}
                value={source}
              >
                {nodes.map((node) => (
                  <option key={node.id} value={node.id}>
                    {node.title}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-fg-neutral text-sm font-medium">도착 노드</span>
              <select
                className="border-stroke-neutral-muted bg-bg-layer-default text-fg-neutral focus:border-stroke-brand-solid focus:ring-stroke-brand-solid h-10 rounded-control border px-3 text-sm outline-none focus:ring-2"
                onChange={(event) => setTarget(event.target.value)}
                value={target}
              >
                {nodes.map((node) => (
                  <option key={node.id} value={node.id}>
                    {node.title}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {error != null && (
            <Callout tone="critical">
              <Callout.Content>
                <Callout.Title>연결할 수 없어요</Callout.Title>
                <Callout.Description>{error}</Callout.Description>
              </Callout.Content>
            </Callout>
          )}

          <div className="flex justify-end gap-2">
            <Button onClick={() => onOpenChange(false)} size="small" variant="ghost">
              취소
            </Button>
            <Button size="small" type="submit">
              연결 만들기
            </Button>
          </div>
        </form>
      )}

      {nodes.length < 2 && (
        <div className="flex justify-end">
          <Button onClick={() => onOpenChange(false)} size="small" variant="ghost">
            닫기
          </Button>
        </div>
      )}
    </WorkflowDialog>
  );
}

export interface DeleteDialogProps {
  linkCount: number;
  nodeCount: number;
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
}

export function DeleteDialog({
  linkCount,
  nodeCount,
  onConfirm,
  onOpenChange,
  open,
}: DeleteDialogProps) {
  return (
    <WorkflowDialog
      description="선택한 항목을 캔버스에서 삭제할까요?"
      id="workflow-delete-dialog"
      onOpenChange={onOpenChange}
      open={open}
      title="선택한 항목 삭제"
    >
      <Callout tone="critical">
        <Callout.Icon>
          <TrashIcon />
        </Callout.Icon>
        <Callout.Content>
          <Callout.Title>
            노드 {nodeCount}개 · 연결 {linkCount}개
          </Callout.Title>
          <Callout.Description>삭제한 항목은 되돌릴 수 없어요.</Callout.Description>
        </Callout.Content>
      </Callout>
      <div className="flex justify-end gap-2">
        <Button onClick={() => onOpenChange(false)} size="small" variant="ghost">
          취소
        </Button>
        <Button
          onClick={() => {
            onConfirm();
            onOpenChange(false);
          }}
          size="small"
          variant="criticalSolid"
        >
          <TrashIcon />
          삭제
        </Button>
      </div>
    </WorkflowDialog>
  );
}

interface DeploymentResponse {
  apiUrl: string;
  deploymentId: string;
  mcpUrl: string;
}

function isDeploymentResponse(value: unknown): value is DeploymentResponse {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }

  const response = value as Record<string, unknown>;
  return (
    typeof response.apiUrl === "string" &&
    typeof response.deploymentId === "string" &&
    typeof response.mcpUrl === "string"
  );
}

export function DeploymentDialog({
  onOpenChange,
  open,
  projectId,
}: {
  onOpenChange: (open: boolean) => void;
  open: boolean;
  projectId: string;
}) {
  const router = useRouter();
  const [deployment, setDeployment] = useState<DeploymentResponse | null>(null);
  const [selectedMode, setSelectedMode] = useState<"api" | "mcp">("api");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setDeployment(null);
      setSelectedMode("api");
      setError(null);
    }
  }, [open]);

  const deploy = async (mode: "api" | "mcp") => {
    setSelectedMode(mode);
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/projects/${projectId}/deploy`, {
        body: JSON.stringify({ mode }),
        headers: { "content-type": "application/json" },
        method: "POST",
      });
      const payload: unknown = await response.json();

      if (!response.ok || !isDeploymentResponse(payload)) {
        throw new Error("배포 주소를 만들지 못했어요.");
      }

      setDeployment(payload);
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "배포 주소를 만들지 못했어요.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <WorkflowDialog
      description="같은 파이프라인을 API와 MCP 두 방식으로 공개할 수 있어요."
      id="project-deployment-dialog"
      onOpenChange={onOpenChange}
      open={open}
      title="배포"
    >
      <div className="flex gap-2">
        <Button
          className="flex-1"
          disabled={loading}
          onClick={() => void deploy("api")}
          size="small"
          variant={selectedMode === "api" ? "brandSolid" : "neutralWeak"}
        >
          {loading && selectedMode === "api" && <Spinner aria-hidden label="" size="small" variant="current" />}
          API 주소 생성
        </Button>
        <Button
          className="flex-1"
          disabled={loading}
          onClick={() => void deploy("mcp")}
          size="small"
          variant={selectedMode === "mcp" ? "brandSolid" : "neutralWeak"}
        >
          {loading && selectedMode === "mcp" && <Spinner aria-hidden label="" size="small" variant="current" />}
          MCP 주소 생성
        </Button>
      </div>

      {error != null && <p className="text-fg-critical text-sm">{error}</p>}
      {deployment != null && (
        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-fg-neutral text-sm font-medium">API endpoint</span>
            <code className="bg-bg-layer-default text-fg-neutral-muted overflow-x-auto rounded-control p-2 text-xs">
              {deployment.apiUrl}
            </code>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-fg-neutral text-sm font-medium">MCP endpoint</span>
            <code className="bg-bg-layer-default text-fg-neutral-muted overflow-x-auto rounded-control p-2 text-xs">
              {deployment.mcpUrl}
            </code>
          </label>
        </div>
      )}

      <div className="flex justify-end">
        <Button onClick={() => onOpenChange(false)} size="small" variant="ghost">
          닫기
        </Button>
      </div>
    </WorkflowDialog>
  );
}
