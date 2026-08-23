"use client";

import { Button, Callout, Spinner } from "@mobydick/design-system";
import { TrashIcon } from "@mobydick/icon";
import { parseGovDataPlan, type GovDataOperationSpec, type GovDataPlan } from "@mobydick/domain";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { match } from "ts-pattern";
import type { CanvasNode, CanvasNodeKind, LinkRejection } from "./workflow-store";
import { dialogTransitionClassName, useDialogTransition } from "@/app/_components/dialog-transition";

interface WorkflowDialogProps {
  className?: string;
  children: ReactNode;
  description?: string;
  id: string;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  title: string;
}

export function WorkflowDialog({
  className,
  children,
  description,
  id,
  onOpenChange,
  open,
  title,
}: WorkflowDialogProps) {
  const dialogRef = useDialogTransition(open);
  const descriptionId = `${id}-description`;
  const titleId = `${id}-title`;

  return (
    <dialog
      aria-describedby={description == null ? undefined : descriptionId}
      aria-labelledby={titleId}
      className={`${dialogTransitionClassName} m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] ${className ?? "max-w-lg"} overflow-y-auto rounded-surface border border-stroke-neutral-subtle bg-bg-layer-modal p-0 text-fg-neutral shadow-elevation-overlay`}
      id={id}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onOpenChange(false);
        }
      }}
      onCancel={(event) => {
        event.preventDefault();
        onOpenChange(false);
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
  onConnect: (source: string, target: string, intent: string, spec: GovDataOperationSpec) => void;
  onOpenChange: (open: boolean) => void;
  question: string;
  open: boolean;
  rejectionFor: (source: string, target: string) => LinkRejection;
}

export function ConnectDialog({
  nodes,
  onConnect,
  onOpenChange,
  question,
  open,
  rejectionFor,
}: ConnectDialogProps) {
  const [source, setSource] = useState("");
  const [target, setTarget] = useState("");
  const [intent, setIntent] = useState("");
  const [plan, setPlan] = useState<GovDataPlan | null>(null);
  const [planning, setPlanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    setSource(nodes[0]?.id ?? "");
    setTarget(nodes[1]?.id ?? "");
    setIntent("");
    setPlan(null);
    setPlanning(false);
    setError(null);
  }, [nodes, open]);

  useEffect(() => () => requestRef.current?.abort(), []);

  const updateSource = (value: string) => {
    setSource(value);
    setPlan(null);
    setError(null);
  };

  const updateTarget = (value: string) => {
    setTarget(value);
    setPlan(null);
    setError(null);
  };

  const updateIntent = (value: string) => {
    setIntent(value);
    setPlan(null);
    setError(null);
  };

  const analyzeIntent = async () => {
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    setPlanning(true);

    try {
      const response = await fetch("/api/govdata/plan", {
        body: JSON.stringify({ query: `${question}\n\n연결 의도: ${intent.trim()}` }),
        headers: { "content-type": "application/json" },
        method: "POST",
        signal: controller.signal,
      });
      const payload: unknown = await response.json();

      if (!response.ok) {
        throw new Error("연결 의도를 실행 스펙으로 바꾸지 못했어요.");
      }

      const parsed = parseGovDataPlan(payload);

      if (parsed == null) {
        throw new Error("planner 응답이 실행 스펙 계약과 맞지 않아요.");
      }

      setPlan(parsed);
    } catch (reason) {
      if (!controller.signal.aborted) {
        setError(reason instanceof Error ? reason.message : "연결 의도를 분석하지 못했어요.");
      }
    } finally {
      if (!controller.signal.aborted && requestRef.current === controller) {
        requestRef.current = null;
        setPlanning(false);
      }
    }
  };

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

    if (intent.trim() === "") {
      setError("이 연결이 어떤 데이터를 만들지 한 문장으로 적어 주세요.");
      return;
    }

    if (plan == null) {
      setError(null);
      void analyzeIntent();
      return;
    }

    onConnect(source, target, intent.trim(), plan.spec);
    onOpenChange(false);
  };

  const sourceNode = nodes.find((node) => node.id === source);
  const targetNode = nodes.find((node) => node.id === target);

  return (
    <WorkflowDialog
      description="출발 노드와 도착 노드를 선택하고, 연결 의도를 선언적 실행 스펙으로 검토해요."
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
                onChange={(event) => updateSource(event.target.value)}
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
                onChange={(event) => updateTarget(event.target.value)}
                value={target}
              >
                {nodes.map((node) => (
                  <option key={node.id} value={node.id}>
                    {node.title}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-fg-neutral text-sm font-medium">연결 의도</span>
              <textarea
                className="border-stroke-neutral-muted bg-bg-layer-default text-fg-neutral placeholder:text-fg-neutral-subtle focus:border-stroke-brand-solid focus:ring-stroke-brand-solid min-h-24 resize-y rounded-control border px-3 py-2 text-sm outline-none focus:ring-2"
                onChange={(event) => updateIntent(event.target.value)}
                placeholder="예: 읍면동 코드로 맞추고 노령인구와 기온을 비교해 우선순위를 만들어요."
                value={intent}
              />
            </label>
          </div>

          {plan != null && (
            <Callout tone={plan.planner === "fallback" ? "warning" : "neutral"}>
              <Callout.Content>
                <Callout.Title>
                  검토할 선언적 스펙 · {plan.planner === "openai" ? "OpenAI planner" : "검증된 fallback"}
                </Callout.Title>
                <Callout.Description>
                  {sourceNode?.title ?? "출발 노드"} → {targetNode?.title ?? "도착 노드"} 연결에 이 스펙을 적용해요. 실행 가능한 코드는 만들지 않아요.
                </Callout.Description>
                <div className="text-fg-neutral mt-3 space-y-1 text-xs">
                  <p>조인 방식: {plan.spec.join ?? "단일 소스"}</p>
                  {plan.spec.sources.map((specSource) => (
                    <p key={specSource.alias}>
                      {specSource.alias} · 키 {specSource.key == null ? "없음" : `${specSource.key.column} · ${specSource.key.level}`} · 집계 {specSource.metrics.length}개
                    </p>
                  ))}
                  <p>정렬 {plan.spec.orderBy.length}개 · 최대 {plan.spec.limit.toLocaleString("ko-KR")}행 · 미리보기 {plan.result.rowCount.toLocaleString("ko-KR")}행</p>
                </div>
                <details className="mt-3">
                  <summary className="text-fg-neutral-muted cursor-pointer text-xs">OperationSpec JSON 보기</summary>
                  <pre className="bg-bg-layer-default text-fg-neutral-muted mt-2 max-h-40 overflow-auto rounded-control p-2 text-[11px] leading-5">
                    {JSON.stringify(plan.spec, null, 2)}
                  </pre>
                </details>
              </Callout.Content>
            </Callout>
          )}

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
            <Button disabled={planning} size="small" type="submit">
              {planning && <Spinner aria-hidden label="" size="small" variant="current" />}
              {planning ? "스펙 분석 중" : plan == null ? "스펙 분석" : "스펙 승인하고 연결"}
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

const API_DEPLOYMENT_EXAMPLE = JSON.stringify({ request: {}, schema: {} }, null, 2);
const FILTERED_API_DEPLOYMENT_EXAMPLE = JSON.stringify(
  { request: { filters: { region: "포항시" } }, schema: {} },
  null,
  2,
);
const MCP_DEPLOYMENT_EXAMPLE = JSON.stringify(
  {
    jsonrpc: "2.0",
    id: "query-1",
    method: "tools/call",
    params: { name: "query_project", arguments: {} },
  },
  null,
  2,
);
const FILTERED_MCP_DEPLOYMENT_EXAMPLE = JSON.stringify(
  {
    jsonrpc: "2.0",
    id: "query-2",
    method: "tools/call",
    params: { name: "query_project", arguments: { request: { filters: { region: "포항시" } } } },
  },
  null,
  2,
);

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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<"api" | "mcp" | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    let cancelled = false;
    setDeployment(null);
    setLoading(true);
    setError(null);
    setCopied(null);

    void (async () => {
      try {
        const response = await fetch(`/api/projects/${projectId}/deploy`, {
          headers: { "content-type": "application/json" },
          method: "POST",
        });
        const payload: unknown = await response.json();

        if (!response.ok || !isDeploymentResponse(payload)) {
          throw new Error("배포 주소를 만들지 못했어요.");
        }

        if (!cancelled) {
          setDeployment(payload);
          router.refresh();
        }
      } catch (reason) {
        if (!cancelled) {
          setError(reason instanceof Error ? reason.message : "배포 주소를 만들지 못했어요.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, projectId, router]);

  const copy = async (mode: "api" | "mcp", url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(mode);
      window.setTimeout(() => setCopied((previous) => (previous === mode ? null : previous)), 1600);
    } catch {
      setError("주소를 복사하지 못했어요. 주소를 직접 선택해 주세요.");
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
      {loading && (
        <div className="text-fg-neutral-muted flex items-center gap-2 text-sm" role="status">
          <Spinner aria-hidden label="" size="small" variant="secondary" />
          API와 MCP 주소를 준비하는 중이에요.
        </div>
      )}
      {error != null && <p className="text-fg-critical text-sm">{error}</p>}
      {deployment != null && (
        <div className="flex flex-col gap-3">
          {(["api", "mcp"] as const).map((mode) => {
            const url = mode === "api" ? deployment.apiUrl : deployment.mcpUrl;

            return (
              <div className="flex flex-col gap-1.5" key={mode}>
                <span className="text-fg-neutral text-sm font-medium">{mode === "api" ? "API endpoint" : "MCP endpoint"}</span>
                <div className="flex min-w-0 items-center gap-2">
                  <code className="bg-bg-layer-default text-fg-neutral-muted min-w-0 flex-1 overflow-x-auto rounded-control p-2 text-xs">
                    {url}
                  </code>
                  <Button onClick={() => void copy(mode, url)} size="small" variant="outline">
                    {copied === mode ? "복사됨" : "복사"}
                  </Button>
                </div>
              </div>
            );
          })}
          <details className="border-stroke-neutral-subtle rounded-control border p-3">
            <summary className="text-fg-neutral cursor-pointer text-sm font-medium">최소 호출 예시</summary>
            <div className="mt-3 flex flex-col gap-3">
              <p className="text-fg-neutral-muted text-xs">request와 schema를 비워두면 프로젝트 설정의 기본값을 사용해요. request.filters를 보내면 연결된 결과 행만 반환해요.</p>
              <div>
                <p className="text-fg-neutral-muted text-xs">API POST body</p>
                <pre className="bg-bg-layer-default text-fg-neutral-muted mt-1 overflow-x-auto rounded-control p-2 text-[11px] leading-5">{API_DEPLOYMENT_EXAMPLE}</pre>
              </div>
              <div>
                <p className="text-fg-neutral-muted text-xs">MCP JSON-RPC body</p>
                <pre className="bg-bg-layer-default text-fg-neutral-muted mt-1 overflow-x-auto rounded-control p-2 text-[11px] leading-5">{MCP_DEPLOYMENT_EXAMPLE}</pre>
              </div>
              <div className="border-stroke-neutral-subtle rounded-control border p-2">
                <p className="text-fg-neutral-muted text-xs">request.filters를 쓰는 호출</p>
                <pre className="bg-bg-layer-default text-fg-neutral-muted mt-1 overflow-x-auto rounded-control p-2 text-[11px] leading-5">{FILTERED_API_DEPLOYMENT_EXAMPLE}</pre>
                <pre className="bg-bg-layer-default text-fg-neutral-muted mt-2 overflow-x-auto rounded-control p-2 text-[11px] leading-5">{FILTERED_MCP_DEPLOYMENT_EXAMPLE}</pre>
              </div>
            </div>
          </details>
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
