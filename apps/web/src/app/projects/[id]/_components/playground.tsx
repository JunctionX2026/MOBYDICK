"use client";

import { Badge, Button, Callout, cn, Spinner } from "@mobydick/design-system";
import {
  AffiliateIcon,
  AlertTriangleIcon,
  DatabaseIcon,
  FocusIcon,
  PlayFilledIcon,
  SendIcon,
  TrashIcon,
  ZoomInIcon,
  ZoomOutIcon,
} from "@mobydick/icon";
import { clamp } from "es-toolkit";
import { deriveGovDataJoinCondition, type GovDataDropReason, type GovDataOperationSpec } from "@mobydick/domain";
import { useEffect, useRef, useState, type PointerEvent, type WheelEvent } from "react";
import { match } from "ts-pattern";
import {
  GRID,
  MAX_ZOOM,
  MIN_ZOOM,
  NODE_HEIGHT,
  NODE_WIDTH,
  PORT_SNAP,
  snapToGrid,
} from "./canvas-metrics";
import {
  useWorkflow,
  type CanvasNode,
  type CanvasNodeKind,
  type CanvasLink,
  type CanvasPosition,
  type LinkRejection,
  type WorkflowExecution,
  type WorkflowNodeExecution,
} from "./workflow-store";
import { DeleteDialog, WorkflowDialog } from "./workflow-dialog";

interface Viewport extends CanvasPosition {
  zoom: number;
}

interface Selection {
  nodes: ReadonlySet<string>;
  links: ReadonlySet<string>;
}

interface NodeContextMenu {
  nodeId: string;
  x: number;
  y: number;
}

type Interaction =
  | { type: "pan"; pointerId: number; clientX: number; clientY: number; origin: CanvasPosition }
  | {
      type: "marquee";
      pointerId: number;
      start: CanvasPosition;
      current: CanvasPosition;
      base: ReadonlySet<string>;
    }
  | {
      type: "drag";
      pointerId: number;
      start: CanvasPosition;
      origins: ReadonlyMap<string, CanvasPosition>;
    }
  | {
      type: "link";
      pointerId: number;
      source: string;
      point: CanvasPosition;
      target: string | null;
      rejection: LinkRejection;
    };

const EMPTY_SELECTION: Selection = { nodes: new Set(), links: new Set() };

function nodeAppearance(kind: CanvasNodeKind) {
  return match(kind)
    .with("SOURCE", () => ({ Icon: DatabaseIcon, label: "소스", tone: "informative" as const }))
    .with("OPERATION", () => ({ Icon: AffiliateIcon, label: "조인·변환", tone: "warning" as const }))
    .with("OUTPUT", () => ({ Icon: SendIcon, label: "출력", tone: "positive" as const }))
    .exhaustive();
}

function outputPort(node: CanvasNode): CanvasPosition {
  return { x: node.position.x + NODE_WIDTH, y: node.position.y + NODE_HEIGHT / 2 };
}

function inputPort(node: CanvasNode): CanvasPosition {
  return { x: node.position.x, y: node.position.y + NODE_HEIGHT / 2 };
}

function upstreamNodeIds(nodeId: string, links: readonly CanvasLink[]) {
  const parents = new Map<string, string[]>();

  for (const link of links) {
    parents.set(link.target, [...(parents.get(link.target) ?? []), link.source]);
  }

  const result = new Set<string>([nodeId]);
  const queue = [nodeId];

  while (queue.length > 0) {
    const current = queue.shift();

    if (current == null) {
      continue;
    }

    for (const parent of parents.get(current) ?? []) {
      if (result.has(parent)) {
        continue;
      }

      result.add(parent);
      queue.push(parent);
    }
  }

  return result;
}

function linkPath(from: CanvasPosition, to: CanvasPosition) {
  const distance = Math.max(48, Math.abs(to.x - from.x) / 2);

  return `M ${from.x} ${from.y} C ${from.x + distance} ${from.y}, ${to.x - distance} ${to.y}, ${to.x} ${to.y}`;
}

function rejectionMessage(rejection: LinkRejection) {
  return match(rejection)
    .with("self", () => "자기 자신에는 연결할 수 없어요")
    .with("duplicate", () => "이미 연결되어 있어요")
    .with("cycle", () => "파이프는 되돌아올 수 없어요")
    .with(null, () => "놓으면 연결돼요")
    .exhaustive();
}

function isTypingTarget(target: EventTarget | null) {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
  );
}

function executionCellText(value: unknown) {
  if (value == null) {
    return "-";
  }

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  return JSON.stringify(value) ?? "-";
}

function droppedReasonText(reason: GovDataDropReason | null) {
  return match(reason)
    .with("missing_normalized_key", () => "선택한 기준으로 정규화할 조인 키가 없어 제외됐어요.")
    .with("unmatched_normalized_key", () => "정규화한 키가 다른 데이터셋에 없어 제외됐어요.")
    .with(null, () => "조인 키가 다른 데이터셋과 맞지 않아 제외됐어요.")
    .exhaustive();
}

function droppedKeysText(keys: readonly string[]) {
  if (keys.length === 0) {
    return "원본 값이 선택한 기준으로 정규화되지 않았어요.";
  }

  const visible = keys.slice(0, 6).join(" · ");
  return keys.length > 6 ? `${visible} 외 ${keys.length - 6}개` : visible;
}

function nodeExecutionText(nodeExecution: WorkflowNodeExecution | undefined) {
  if (nodeExecution == null) {
    return null;
  }

  if (nodeExecution.status === "running") {
    return "실행 중";
  }

  if (nodeExecution.status === "error") {
    return `실행 실패 · ${nodeExecution.error ?? "알 수 없는 오류"}`;
  }

  if (nodeExecution.result == null) {
    return "결과 없음";
  }

  const matchRates = nodeExecution.result.droppedDetail.map((detail) => detail.matchRate);
  const lowestMatchRate = matchRates.length > 0 ? Math.min(...matchRates) : null;
  const nullRate = Number.isFinite(nodeExecution.result.nullRate)
    ? Math.round(nodeExecution.result.nullRate * 100)
    : null;

  return `${nodeExecution.result.rowCount.toLocaleString("ko-KR")}행 · ${nodeExecution.result.columns.length}컬럼${
    nullRate == null ? "" : ` · 결측 ${nullRate}%`
  }${
    lowestMatchRate == null ? "" : ` · 매칭 ${Math.round(lowestMatchRate * 100)}%`
  }`;
}

function ExecutionDetailsDialog({
  execution,
  onOpenChange,
  open,
}: {
  execution: WorkflowExecution;
  onOpenChange: (open: boolean) => void;
  open: boolean;
}) {
  const result = execution.result;

  if (result == null) {
    return null;
  }

  const droppedDetails = result.droppedDetail.filter((detail) => detail.dropped > 0);

  return (
    <WorkflowDialog
      className="max-w-4xl"
      description="실행 요청과 결과를 함께 검토할 수 있어요. 표에는 앞부분 8행을 보여줘요."
      id="workflow-execution-details-dialog"
      onOpenChange={onOpenChange}
      open={open}
      title={`${execution.nodeTitle ?? "노드"} 실행 상세`}
    >
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <span className="text-fg-neutral text-sm font-medium">결과 미리보기</span>
          <span className="text-fg-neutral-muted text-xs tabular-nums">
            {result.rowCount.toLocaleString("ko-KR")}행 · {result.columns.length}컬럼
          </span>
        </div>
        <p className="text-fg-neutral-muted truncate text-xs">
          {result.sources.map((source) => source.title).join(" · ")}
        </p>

        <div className="border-stroke-neutral-subtle overflow-x-auto rounded-control border">
          <table className="min-w-full text-left text-xs">
            <thead className="bg-bg-layer-default text-fg-neutral-muted">
              <tr>
                {result.columns.map((column) => (
                  <th className="whitespace-nowrap px-3 py-2 font-medium" key={column} scope="col">
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-stroke-neutral-subtle divide-y">
              {result.rows.slice(0, 8).map((row, rowIndex) => (
                <tr className="text-fg-neutral" key={rowIndex}>
                  {result.columns.map((_column, columnIndex) => (
                    <td className="max-w-48 truncate whitespace-nowrap px-3 py-2" key={`${rowIndex}-${columnIndex}`}>
                      {executionCellText(row[columnIndex])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {droppedDetails.length > 0 && (
          <details>
            <summary className="text-fg-neutral-muted cursor-pointer text-xs">
              조인에서 제외된 키와 사유 · {droppedDetails.map((detail) => `${detail.title} ${detail.dropped.toLocaleString("ko-KR")}개`).join(" · ")}
            </summary>
            <div className="mt-2">
              <Callout tone="warning">
                <Callout.Content>
                  <Callout.Description>
                    {droppedDetails.map((detail) => (
                      <p key={detail.datasetId}>
                        <span className="text-fg-neutral font-medium">{detail.alias}</span> · {droppedReasonText(detail.reasonCode)} 탈락 키: {droppedKeysText(detail.droppedKeys)}
                      </p>
                    ))}
                  </Callout.Description>
                </Callout.Content>
              </Callout>
            </div>
          </details>
        )}

        <details>
          <summary className="text-fg-neutral-muted cursor-pointer text-xs">REST payload · response</summary>
          <pre className="bg-bg-layer-default text-fg-neutral-muted mt-2 max-h-64 overflow-auto rounded-control p-3 text-[11px] leading-5">
            {JSON.stringify(
              {
                payload: execution.request?.body,
                response: {
                  columns: result.columns,
                  rows: result.rows.slice(0, 5),
                  row_count: result.rowCount,
                  dropped_detail: result.droppedDetail,
                  ...(result.output == null ? {} : { output: result.output }),
                },
              },
              null,
              2,
            )}
          </pre>
        </details>

        <div className="flex justify-end">
          <Button onClick={() => onOpenChange(false)} size="small" variant="ghost">
            닫기
          </Button>
        </div>
      </div>
    </WorkflowDialog>
  );
}

function OperationNodeDetailsDialog({
  executeNode,
  execution,
  node,
  onOpenChange,
  open,
  operationSpec,
  question,
}: {
  executeNode: (nodeId: string) => Promise<void>;
  execution: WorkflowExecution;
  node: CanvasNode | null;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  operationSpec: GovDataOperationSpec | null;
  question: string;
}) {
  if (node == null) {
    return null;
  }

  const condition = operationSpec == null ? null : deriveGovDataJoinCondition(operationSpec);
  const levelLabel = (level: "emd" | "raw" | "sgg") => ({ emd: "읍면동", raw: "원문 값", sgg: "시군구" })[level];

  return (
    <WorkflowDialog
      className="max-w-2xl"
      description="질문에서 변환된 조인 조건과 실행 계약을 한 곳에서 확인할 수 있어요."
      id="workflow-operation-details-dialog"
      onOpenChange={onOpenChange}
      open={open}
      title="조인·변환 노드 상세"
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge emphasis="weak" size="small" tone="warning">
            질문 → 조인·변환
          </Badge>
          {condition != null && (
            <span className="text-fg-neutral-muted text-xs">
              {condition.sources.length}개 소스 · {condition.mode === "left" ? "left 조인" : condition.mode === "inner" ? "inner 조인" : "단일 소스"} · 기준 {condition.levels.map(levelLabel).join(" · ") || "없음"}
            </span>
          )}
        </div>

        <div className="border-stroke-neutral-subtle bg-bg-layer-side-navigation rounded-control border p-3">
          <p className="text-fg-neutral-muted text-xs font-medium">질문</p>
          <p className="text-fg-neutral mt-1 text-sm leading-6">{question}</p>
        </div>

        {condition == null ? (
          <Callout tone="warning">
            <Callout.Content>
              <Callout.Title>아직 실행 계약이 없어요</Callout.Title>
              <Callout.Description>이 노드를 실행하면 질문에서 OperationSpec을 다시 만들어요.</Callout.Description>
            </Callout.Content>
          </Callout>
        ) : (
          <div>
            <p className="text-fg-neutral-muted text-xs font-medium">변환된 조인 조건</p>
            <div className="mt-2 grid gap-2 sm:grid-cols-3">
              {condition.sources.map((source) => (
                <div className="border-stroke-neutral-subtle bg-bg-layer-default rounded-control border p-3" key={source.alias}>
                  <p className="text-fg-neutral text-sm font-semibold">{source.alias}</p>
                  <p className="text-fg-neutral-muted mt-1 text-xs">
                    {source.column ?? "조인 키 없음"} · {source.level == null ? "기준 없음" : levelLabel(source.level)}
                  </p>
                  <p className="text-fg-neutral-subtle mt-1 truncate text-[11px]" title={source.datasetId}>
                    {source.datasetId}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {operationSpec != null && (
          <details open>
            <summary className="text-fg-neutral-muted cursor-pointer text-xs">OperationSpec 전체 보기</summary>
            <pre className="bg-bg-layer-default text-fg-neutral-muted mt-2 max-h-72 overflow-auto rounded-control p-3 text-[11px] leading-5">
              {JSON.stringify(operationSpec, null, 2)}
            </pre>
          </details>
        )}

        <div className="flex flex-wrap justify-end gap-2">
          <Button onClick={() => onOpenChange(false)} size="small" variant="ghost">
            닫기
          </Button>
          <Button
            disabled={execution.status === "running"}
            onClick={() => {
              onOpenChange(false);
              void executeNode(node.id);
            }}
            size="small"
            variant="outline"
          >
            {execution.status === "running" ? <Spinner aria-hidden label="" size="small" variant="current" /> : <PlayFilledIcon />}
            중간 결과 실행
          </Button>
        </div>
      </div>
    </WorkflowDialog>
  );
}

export function Playground({ question }: { question: string }) {
  const {
    addNode,
    connect,
    error,
    executeNode,
    execution,
    links,
    moveNodes,
    lastAddedId,
    nodes,
    nodeExecutions,
    operationSpec,
    rejectionFor,
    remove,
  } =
    useWorkflow();
  const surface = useRef<HTMLDivElement>(null);
  const [viewport, setViewport] = useState<Viewport>({ x: 96, y: 96, zoom: 1 });
  const [interaction, setInteraction] = useState<Interaction | null>(null);
  const [selection, setSelection] = useState<Selection>(EMPTY_SELECTION);
  const [panMode, setPanMode] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [executionDetailsOpen, setExecutionDetailsOpen] = useState(false);
  const [operationDetailsOpen, setOperationDetailsOpen] = useState(false);
  const [contextMenu, setContextMenu] = useState<NodeContextMenu | null>(null);
  const draggedNodeRef = useRef(false);

  const toCanvas = (clientX: number, clientY: number): CanvasPosition => {
    const rect = surface.current?.getBoundingClientRect();

    if (rect == null) {
      return { x: 0, y: 0 };
    }

    return {
      x: (clientX - rect.left - viewport.x) / viewport.zoom,
      y: (clientY - rect.top - viewport.y) / viewport.zoom,
    };
  };

  const zoomAround = (nextZoom: number, anchor?: { clientX: number; clientY: number }) => {
    setViewport((previous) => {
      const zoom = clamp(nextZoom, MIN_ZOOM, MAX_ZOOM);
      const rect = surface.current?.getBoundingClientRect();

      if (rect == null) {
        return { ...previous, zoom };
      }

      const pointX = (anchor?.clientX ?? rect.left + rect.width / 2) - rect.left;
      const pointY = (anchor?.clientY ?? rect.top + rect.height / 2) - rect.top;
      const ratio = zoom / previous.zoom;

      return {
        zoom,
        x: pointX - (pointX - previous.x) * ratio,
        y: pointY - (pointY - previous.y) * ratio,
      };
    });
  };

  const centerOn = (node: CanvasNode) => {
    const rect = surface.current?.getBoundingClientRect();

    if (rect == null) {
      return;
    }

    setViewport((previous) => ({
      ...previous,
      x: rect.width / 2 - (node.position.x + NODE_WIDTH / 2) * previous.zoom,
      y: rect.height / 2 - (node.position.y + NODE_HEIGHT / 2) * previous.zoom,
    }));
  };

  const fitView = () => {
    const rect = surface.current?.getBoundingClientRect();

    if (rect == null || nodes.length === 0) {
      setViewport({ x: 96, y: 96, zoom: 1 });
      return;
    }

    const left = Math.min(...nodes.map((node) => node.position.x));
    const top = Math.min(...nodes.map((node) => node.position.y));
    const right = Math.max(...nodes.map((node) => node.position.x)) + NODE_WIDTH;
    const bottom = Math.max(...nodes.map((node) => node.position.y)) + NODE_HEIGHT;
    const padding = 80;
    const zoom = clamp(
      Math.min(
        (rect.width - padding * 2) / (right - left),
        (rect.height - padding * 2) / (bottom - top),
      ),
      MIN_ZOOM,
      1,
    );

    setViewport({
      zoom,
      x: (rect.width - (right - left) * zoom) / 2 - left * zoom,
      y: (rect.height - (bottom - top) * zoom) / 2 - top * zoom,
    });
  };

  const selectOnly = (nodeId: string) =>
    setSelection({ nodes: new Set([nodeId]), links: new Set() });

  useEffect(() => {
    if (lastAddedId == null) {
      return;
    }

    const added = nodes.find((node) => node.id === lastAddedId);

    if (added != null) {
      selectOnly(added.id);
      centerOn(added);
    }
    /** Only a brand new node moves the viewport, never a later edit of it. */
  }, [lastAddedId]);

  useEffect(() => {
    if (contextMenu == null) {
      return;
    }

    const closeContextMenu = () => setContextMenu(null);

    window.addEventListener("pointerdown", closeContextMenu);

    return () => window.removeEventListener("pointerdown", closeContextMenu);
  }, [contextMenu]);

  useEffect(() => {
    const hasResultDetails =
      execution.result != null && (execution.status === "success" || execution.status === "error");

    setExecutionDetailsOpen(hasResultDetails);
  }, [execution.result, execution.status]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isTypingTarget(event.target)) {
        return;
      }

      if (event.key === " " && !event.repeat) {
        setPanMode(true);
        return;
      }

      if (event.key === "Escape") {
        setSelection(EMPTY_SELECTION);
        setInteraction(null);
        setContextMenu(null);
        return;
      }

      if (event.key === "Delete" || event.key === "Backspace") {
        if (selection.nodes.size + selection.links.size === 0) {
          return;
        }

        event.preventDefault();
        setDeleteDialogOpen(true);
        return;
      }

      if (event.key.toLowerCase() === "a" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setSelection({ nodes: new Set(nodes.map((node) => node.id)), links: new Set() });
        return;
      }

      if (event.key === "0") {
        zoomAround(1);
        return;
      }

      if (event.key === "1") {
        fitView();
      }
    };

    const onKeyUp = (event: KeyboardEvent) => {
      if (event.key === " ") {
        setPanMode(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  });

  const startPan = (event: PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    setInteraction({
      type: "pan",
      pointerId: event.pointerId,
      clientX: event.clientX,
      clientY: event.clientY,
      origin: { x: viewport.x, y: viewport.y },
    });
  };

  const beginNodeDrag = (event: PointerEvent<HTMLDivElement>, node: CanvasNode) => {
    draggedNodeRef.current = false;
    const additive = event.shiftKey || event.metaKey || event.ctrlKey;
    const nodeIds = additive
      ? new Set(selection.nodes).add(node.id)
      : selection.nodes.has(node.id)
        ? selection.nodes
        : new Set([node.id]);

    if (additive && selection.nodes.has(node.id)) {
      const without = new Set(selection.nodes);
      without.delete(node.id);
      setSelection({ nodes: without, links: new Set() });
      return;
    }

    setSelection({ nodes: nodeIds, links: new Set() });
    event.currentTarget.setPointerCapture(event.pointerId);
    setInteraction({
      type: "drag",
      pointerId: event.pointerId,
      start: toCanvas(event.clientX, event.clientY),
      origins: new Map(
        nodes.filter((candidate) => nodeIds.has(candidate.id)).map((c) => [c.id, c.position]),
      ),
    });
  };

  const nearestInput = (point: CanvasPosition, source: string) => {
    let closest: { node: CanvasNode; distance: number } | null = null;

    for (const node of nodes) {
      if (node.id === source) {
        continue;
      }

      const port = inputPort(node);
      const distance = Math.hypot(port.x - point.x, port.y - point.y);

      if (distance <= PORT_SNAP && (closest == null || distance < closest.distance)) {
        closest = { node, distance };
      }
    }

    return closest?.node ?? null;
  };

  const handlePointerMove = (event: PointerEvent<Element>) => {
    if (interaction == null || interaction.pointerId !== event.pointerId) {
      return;
    }

    // Pointer capture keeps firing on the origin element, so the same event
    // would otherwise bubble into the node and surface handlers as well.
    event.stopPropagation();

    match(interaction)
      .with({ type: "pan" }, (pan) =>
        setViewport((previous) => ({
          ...previous,
          x: pan.origin.x + (event.clientX - pan.clientX),
          y: pan.origin.y + (event.clientY - pan.clientY),
        })),
      )
      .with({ type: "marquee" }, (marquee) =>
        setInteraction({ ...marquee, current: toCanvas(event.clientX, event.clientY) }),
      )
      .with({ type: "drag" }, (drag) => {
        const point = toCanvas(event.clientX, event.clientY);

        draggedNodeRef.current = point.x !== drag.start.x || point.y !== drag.start.y;

        moveNodes(
          [...drag.origins].map(([id, origin]) => ({
            id,
            position: {
              x: snapToGrid(origin.x + point.x - drag.start.x),
              y: snapToGrid(origin.y + point.y - drag.start.y),
            },
          })),
        );
      })
      .with({ type: "link" }, (link) => {
        const point = toCanvas(event.clientX, event.clientY);
        const target = nearestInput(point, link.source);

        setInteraction({
          ...link,
          point,
          target: target?.id ?? null,
          rejection: target == null ? null : rejectionFor(link.source, target.id),
        });
      })
      .exhaustive();
  };

  const finishInteraction = (event: PointerEvent<Element>) => {
    if (interaction == null || interaction.pointerId !== event.pointerId) {
      return;
    }

    event.stopPropagation();

    if (interaction.type === "marquee") {
      const left = Math.min(interaction.start.x, interaction.current.x);
      const right = Math.max(interaction.start.x, interaction.current.x);
      const top = Math.min(interaction.start.y, interaction.current.y);
      const bottom = Math.max(interaction.start.y, interaction.current.y);
      const covered = new Set(interaction.base);

      for (const node of nodes) {
        const overlaps =
          node.position.x < right &&
          node.position.x + NODE_WIDTH > left &&
          node.position.y < bottom &&
          node.position.y + NODE_HEIGHT > top;

        if (overlaps) {
          covered.add(node.id);
        }
      }

      setSelection({ nodes: covered, links: new Set() });
    }

    if (interaction.type === "link" && interaction.target != null && interaction.rejection == null) {
      connect(interaction.source, interaction.target);
    }

    setInteraction(null);
  };

  const marqueeRect =
    interaction?.type === "marquee"
      ? {
          left: Math.min(interaction.start.x, interaction.current.x),
          top: Math.min(interaction.start.y, interaction.current.y),
          width: Math.abs(interaction.current.x - interaction.start.x),
          height: Math.abs(interaction.current.y - interaction.start.y),
        }
      : null;

  const draggedSource =
    interaction?.type === "link" ? nodes.find((node) => node.id === interaction.source) : undefined;
  const executingNodeIds =
    execution.status === "running" && execution.nodeId != null
      ? upstreamNodeIds(execution.nodeId, links)
      : new Set<string>();

  return (
    <div className="relative flex h-full min-h-0 flex-col">
      <div
        className="bg-bg-layer-basement relative flex-1 touch-none overscroll-contain overflow-hidden"
        onPointerDown={(event) => {
          if (event.button === 1 || panMode) {
            startPan(event);
            return;
          }

          if (event.button !== 0) {
            return;
          }

          const additive = event.shiftKey || event.metaKey || event.ctrlKey;

          if (!additive) {
            setSelection(EMPTY_SELECTION);
          }

          event.currentTarget.setPointerCapture(event.pointerId);
          const start = toCanvas(event.clientX, event.clientY);
          setInteraction({
            type: "marquee",
            pointerId: event.pointerId,
            start,
            current: start,
            base: additive ? selection.nodes : new Set(),
          });
        }}
        onPointerMove={handlePointerMove}
        onPointerUp={finishInteraction}
        onPointerCancel={finishInteraction}
        onWheel={(wheel: WheelEvent<HTMLDivElement>) => {
          wheel.preventDefault();

          if (wheel.ctrlKey || wheel.metaKey) {
            zoomAround(viewport.zoom * (wheel.deltaY > 0 ? 0.92 : 1.08), wheel);
            return;
          }

          setViewport((previous) => ({
            ...previous,
            x: previous.x - wheel.deltaX,
            y: previous.y - wheel.deltaY,
          }));
        }}
        ref={surface}
        style={{
          backgroundImage:
            "radial-gradient(circle, var(--moby-color-stroke-neutral-muted) 1px, transparent 1px)",
          backgroundSize: `${GRID * 2 * viewport.zoom}px ${GRID * 2 * viewport.zoom}px`,
          backgroundPosition: `${viewport.x}px ${viewport.y}px`,
          cursor: match({ interaction: interaction?.type, panMode })
            .with({ interaction: "pan" }, () => "grabbing")
            .with({ panMode: true }, () => "grab")
            .with({ interaction: "link" }, () => "crosshair")
            .otherwise(() => "default"),
        }}
      >
        <div
          className="absolute top-0 left-0 h-full w-full origin-top-left"
          style={{
            transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
          }}
        >
          <svg className="pointer-events-none absolute top-0 left-0 h-full w-full overflow-visible">
            {links.map((link) => {
              const from = nodes.find((node) => node.id === link.source);
              const to = nodes.find((node) => node.id === link.target);

              if (from == null || to == null) {
                return null;
              }

              const path = linkPath(outputPort(from), inputPort(to));
              const isSelected = selection.links.has(link.id);
              const isExecutionLink =
                execution.status === "running" &&
                executingNodeIds.has(link.source) &&
                executingNodeIds.has(link.target);

              return (
                <g key={link.id}>
                  <path
                    className={cn(
                      "fill-none transition-[stroke,stroke-width] duration-[var(--moby-duration-fast)]",
                      isSelected ? "stroke-stroke-critical-solid" : "stroke-stroke-brand-solid",
                      isExecutionLink && "animate-pulse motion-reduce:animate-none",
                    )}
                    d={path}
                    strokeDasharray={isExecutionLink ? "6 6" : undefined}
                    strokeWidth={isSelected ? 3 : 2}
                  />
                  <path
                    className="pointer-events-auto cursor-pointer fill-none stroke-transparent"
                    d={path}
                    onPointerDown={(event) => {
                      event.stopPropagation();
                      setSelection({ nodes: new Set(), links: new Set([link.id]) });
                    }}
                    strokeWidth={16}
                  >
                    <title>{link.intent == null ? "연결 선택" : `연결 의도: ${link.intent}`}</title>
                  </path>
                </g>
              );
            })}

            {draggedSource != null && interaction?.type === "link" && (
              <path
                className={cn(
                  "fill-none",
                  interaction.rejection == null
                    ? "stroke-stroke-brand-solid"
                    : "stroke-stroke-critical-solid",
                )}
                d={linkPath(
                  outputPort(draggedSource),
                  match(nodes.find((node) => node.id === interaction.target))
                    .when(
                      (node): node is CanvasNode => node != null && interaction.rejection == null,
                      inputPort,
                    )
                    .otherwise(() => interaction.point),
                )}
                strokeDasharray="6 6"
                strokeWidth={2}
              />
            )}

            {marqueeRect != null && (
              <rect
                className="fill-bg-transparent-selected stroke-stroke-brand-solid"
                height={marqueeRect.height}
                strokeDasharray="4 4"
                width={marqueeRect.width}
                x={marqueeRect.left}
                y={marqueeRect.top}
              />
            )}
          </svg>

          {nodes.map((node) => {
            const { Icon, label, tone } = nodeAppearance(node.kind);
            const isSelected = selection.nodes.has(node.id);
            const isLinkTarget = interaction?.type === "link" && interaction.target === node.id;
            const isExecuting = execution.status === "running" && execution.nodeId === node.id;
            const isExecutionInput = execution.status === "running" && executingNodeIds.has(node.id);
            const nodeExecution = nodeExecutions[node.id];
            const isNodeExecuting = nodeExecution?.status === "running";
            const nodeExecutionLabel = nodeExecutionText(nodeExecution);

            return (
              <div
                className={cn(
                  "border-stroke-neutral-subtle bg-bg-layer-side-navigation shadow-elevation-raised rounded-surface absolute border transition-[border-color,box-shadow,opacity] duration-[var(--moby-duration-fast)]",
                  isSelected && "border-stroke-brand-solid shadow-elevation-floating",
                  isExecutionInput && !isExecuting && "border-stroke-brand-weak opacity-80",
                  isExecuting &&
                    "border-stroke-brand-solid shadow-elevation-floating ring-2 ring-stroke-brand-weak animate-pulse motion-reduce:animate-none",
                  isNodeExecuting &&
                    !isExecuting &&
                    "border-stroke-brand-solid ring-2 ring-stroke-brand-weak animate-pulse motion-reduce:animate-none",
                  nodeExecution?.status === "success" && !isExecuting && "border-stroke-brand-weak",
                  nodeExecution?.status === "error" && "border-stroke-critical-solid",
                  isLinkTarget &&
                    (interaction.rejection == null
                      ? "border-stroke-brand-solid"
                      : "border-stroke-critical-solid"),
                )}
                data-canvas-node={node.id}
                data-selected={isSelected}
                key={node.id}
                onClick={() => {
                  if (node.kind === "OPERATION" && !draggedNodeRef.current) {
                    setOperationDetailsOpen(true);
                  }

                  draggedNodeRef.current = false;
                }}
                onPointerDown={(event) => {
                  if (event.button !== 0 || panMode) {
                    return;
                  }

                  event.stopPropagation();
                  beginNodeDrag(event, node);
                }}
                onPointerMove={handlePointerMove}
                onPointerUp={finishInteraction}
                onPointerCancel={finishInteraction}
                onContextMenu={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  setSelection({ nodes: new Set([node.id]), links: new Set() });
                  setContextMenu({ nodeId: node.id, x: event.clientX, y: event.clientY });
                }}
                onKeyDown={(event) => {
                  if (node.kind !== "OPERATION" || (event.key !== "Enter" && event.key !== " ")) {
                    return;
                  }

                  event.preventDefault();
                  setOperationDetailsOpen(true);
                }}
                role={node.kind === "OPERATION" ? "button" : undefined}
                style={{
                  cursor: interaction?.type === "drag" ? "grabbing" : "grab",
                  height: NODE_HEIGHT,
                  left: node.position.x,
                  top: node.position.y,
                  width: NODE_WIDTH,
                }}
                tabIndex={node.kind === "OPERATION" ? 0 : undefined}
                data-execution-state={
                  isExecuting
                    ? "running"
                    : nodeExecution?.status === "error"
                      ? "error"
                      : nodeExecution?.status === "success"
                        ? "success"
                        : isExecutionInput
                          ? "upstream"
                          : "idle"
                }
              >
                <div className="flex h-full flex-col justify-center gap-1 px-3">
                  <div className="flex items-center gap-2">
                    <span className="text-fg-neutral-subtle">
                      <Icon size={16} />
                    </span>
                    <span className="text-fg-neutral truncate text-sm font-semibold">
                      {node.title}
                    </span>
                    {(isExecuting || isNodeExecuting) && (
                      <Spinner aria-hidden label="" size="small" variant="secondary" />
                    )}
                    <button
                      aria-label={`${node.title} 실행`}
                      className="text-fg-neutral-muted hover:bg-bg-transparent-pressed hover:text-fg-neutral focus-visible:ring-stroke-brand-solid ml-auto inline-flex size-6 shrink-0 items-center justify-center rounded-full transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-40"
                      disabled={
                        execution.status === "running" ||
                        (node.kind === "SOURCE" && node.datasetId == null)
                      }
                      onClick={(event) => {
                        event.stopPropagation();
                        void executeNode(node.id);
                      }}
                      onPointerDown={(event) => event.stopPropagation()}
                      title="이 노드 실행"
                      type="button"
                    >
                      <PlayFilledIcon size={12} />
                    </button>
                    <Badge emphasis="weak" size="small" tone={tone}>
                      {label}
                    </Badge>
                  </div>
                  <p
                    className={cn(
                      "truncate text-xs",
                      nodeExecution?.status === "error"
                        ? "text-fg-critical"
                        : nodeExecutionLabel == null
                          ? "text-fg-neutral-subtle"
                          : "text-fg-neutral",
                    )}
                    title={nodeExecutionLabel ?? node.subtitle ?? undefined}
                  >
                    {nodeExecutionLabel ?? node.subtitle ?? "데이터를 아직 고르지 않았어요"}
                  </p>
                  {nodeExecutionLabel != null && node.subtitle != null && (
                    <p className="text-fg-neutral-subtle truncate text-[11px]" title={node.subtitle}>
                      {node.subtitle}
                    </p>
                  )}
                </div>

                <span
                  aria-hidden
                  className={cn(
                    "border-stroke-neutral-subtle bg-bg-layer-side-navigation rounded-pill absolute top-1/2 -left-1.5 size-3 -translate-y-1/2 border",
                    isLinkTarget && "border-stroke-brand-solid scale-150",
                  )}
                />
                <button
                  aria-label={`${node.title}에서 연결 시작`}
                  className="border-stroke-brand-solid bg-bg-layer-side-navigation rounded-pill hover:scale-150 absolute top-1/2 -right-1.5 size-3 -translate-y-1/2 cursor-crosshair border transition-transform"
                  onPointerDown={(event) => {
                    event.stopPropagation();
                    event.currentTarget.setPointerCapture(event.pointerId);
                    setInteraction({
                      type: "link",
                      pointerId: event.pointerId,
                      source: node.id,
                      point: toCanvas(event.clientX, event.clientY),
                      target: null,
                      rejection: null,
                    });
                  }}
                  onPointerMove={handlePointerMove}
                  onPointerUp={finishInteraction}
                  onPointerCancel={finishInteraction}
                  type="button"
                />
              </div>
            );
          })}
        </div>

        {nodes.length === 0 && (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-3 text-center">
            <p className="text-fg-neutral text-sm font-semibold">캔버스가 비어 있어요</p>
            <p className="text-fg-neutral-muted break-keep max-w-xs text-xs">
              왼쪽에서 노드를 추가하고, 노드 오른쪽 점을 끌어서 다음 노드에 연결해요.
            </p>
            <Button
              className="pointer-events-auto"
              onPointerDown={(event) => event.stopPropagation()}
              onClick={() => addNode("SOURCE")}
              size="small"
              variant="outline"
            >
              <DatabaseIcon />
              데이터 소스 추가
            </Button>
          </div>
        )}

        {interaction?.type === "link" && interaction.target != null && (
          <div className="bg-bg-layer-side-navigation border-stroke-neutral-subtle rounded-pill shadow-elevation-raised text-fg-neutral-muted pointer-events-none absolute top-4 left-1/2 -translate-x-1/2 border px-3 py-1 text-xs">
            {rejectionMessage(interaction.rejection)}
          </div>
        )}

        {execution.status === "running" && (
          <div
            aria-live="polite"
            className="border-stroke-neutral-subtle bg-bg-layer-side-navigation text-fg-neutral shadow-elevation-floating absolute bottom-20 left-1/2 z-20 w-[min(42rem,calc(100%-2rem))] -translate-x-1/2 rounded-[20px] border px-4 py-3 backdrop-blur-[30px]"
            onPointerDown={(event) => event.stopPropagation()}
          >
            <div className="text-fg-neutral-muted flex items-center gap-2 text-sm">
              <Spinner aria-hidden label="" size="small" variant="secondary" />
              {execution.nodeTitle ?? "노드"}부터 선행 데이터를 실행하는 중이에요.
            </div>
          </div>
        )}

        {execution.status === "error" && execution.result == null && (
          <div
            aria-live="polite"
            className="border-stroke-critical-solid bg-bg-layer-side-navigation text-fg-critical shadow-elevation-floating absolute bottom-20 left-1/2 flex w-[min(42rem,calc(100%-2rem))] -translate-x-1/2 items-center gap-2 rounded-[20px] border px-4 py-3 text-sm backdrop-blur-[30px]"
            onPointerDown={(event) => event.stopPropagation()}
          >
            <AlertTriangleIcon size={16} />
            {execution.error ?? "노드를 실행하지 못했어요."}
          </div>
        )}

        <div
          className="border-stroke-neutral-subtle bg-bg-layer-side-navigation rounded-pill shadow-elevation-raised absolute bottom-4 left-4 flex items-center gap-1 border p-1"
          onPointerDown={(event) => event.stopPropagation()}
        >
          <Button
            aria-label="축소"
            iconOnly
            onClick={() => zoomAround(viewport.zoom * 0.9)}
            shape="pill"
            size="small"
            variant="ghost"
          >
            <ZoomOutIcon />
          </Button>
          <span className="text-fg-neutral-muted w-12 text-center text-xs tabular-nums">
            {Math.round(viewport.zoom * 100)}%
          </span>
          <Button
            aria-label="확대"
            iconOnly
            onClick={() => zoomAround(viewport.zoom * 1.1)}
            shape="pill"
            size="small"
            variant="ghost"
          >
            <ZoomInIcon />
          </Button>
          <Button
            aria-label="전체 보기"
            iconOnly
            onClick={fitView}
            shape="pill"
            size="small"
            variant="ghost"
          >
            <FocusIcon />
          </Button>
        </div>

        {selection.nodes.size + selection.links.size > 0 && (
          <div
            className="border-stroke-neutral-subtle bg-bg-layer-side-navigation shadow-elevation-floating text-fg-neutral absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-[20px] border py-2 pr-2 pl-4 text-xs backdrop-blur-[30px]"
            onPointerDown={(event) => event.stopPropagation()}
          >
            <span>
              노드 {selection.nodes.size} · 연결 {selection.links.size}
            </span>
            <Button
              onClick={() => setDeleteDialogOpen(true)}
              shape="pill"
              size="small"
              variant="criticalSolid"
            >
              삭제
            </Button>
          </div>
        )}
      </div>

      {contextMenu != null && (
        <div
          aria-label={`노드 ${contextMenu.nodeId} 메뉴`}
          className="border-stroke-neutral-subtle bg-bg-layer-side-navigation rounded-surface shadow-elevation-floating fixed z-40 min-w-36 border p-1 animate-[moby-pop-in_var(--moby-duration-fast)_ease-standard] motion-reduce:animate-none"
          data-context-menu-node={contextMenu.nodeId}
          onContextMenu={(event) => event.preventDefault()}
          onPointerDown={(event) => event.stopPropagation()}
          role="menu"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <Button
            className="w-full justify-start"
            disabled={execution.status === "running"}
            onClick={() => {
              const nodeId = contextMenu.nodeId;
              setContextMenu(null);
              void executeNode(nodeId);
            }}
            size="small"
            variant="ghost"
          >
            {execution.status === "running" ? <Spinner aria-hidden label="" size="small" variant="current" /> : <PlayFilledIcon />}
            실행
          </Button>
          <Button
            className="w-full justify-start"
            onClick={() => {
              setContextMenu(null);
              setDeleteDialogOpen(true);
            }}
            size="small"
            variant="ghost"
          >
            <TrashIcon />
            노드 삭제
          </Button>
        </div>
      )}

      {error != null && (
        <div className="absolute right-4 bottom-16 max-w-sm">
          <Callout tone="critical">
            <Callout.Icon>
              <AlertTriangleIcon />
            </Callout.Icon>
            <Callout.Content>
              <Callout.Title>워크플로를 저장하지 못했어요</Callout.Title>
              <Callout.Description>{error}</Callout.Description>
            </Callout.Content>
          </Callout>
        </div>
      )}

      <ExecutionDetailsDialog
        execution={execution}
        onOpenChange={setExecutionDetailsOpen}
        open={executionDetailsOpen}
      />

      <OperationNodeDetailsDialog
        executeNode={executeNode}
        execution={execution}
        node={nodes.find((node) => node.kind === "OPERATION") ?? null}
        onOpenChange={setOperationDetailsOpen}
        open={operationDetailsOpen}
        operationSpec={operationSpec}
        question={question}
      />

      <DeleteDialog
        linkCount={selection.links.size}
        nodeCount={selection.nodes.size}
        onConfirm={() => {
          remove(selection.nodes, selection.links);
          setSelection(EMPTY_SELECTION);
        }}
        onOpenChange={setDeleteDialogOpen}
        open={deleteDialogOpen}
      />
    </div>
  );
}
