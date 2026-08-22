"use client";

import { Badge, Button, Callout, cn } from "@mobydick/design-system";
import {
  AlertTriangleIcon,
  DatabaseIcon,
  FocusIcon,
  RocketIcon,
  TrashIcon,
  WorkflowIcon,
  ZoomInIcon,
  ZoomOutIcon,
} from "@mobydick/icon";
import { clamp } from "es-toolkit";
import { useRef, useState, type PointerEvent, type WheelEvent } from "react";
import { match } from "ts-pattern";
import { useWorkflow, type CanvasNodeKind, type CanvasPosition } from "./workflow-store";

const NODE_WIDTH = 216;
const NODE_HEIGHT = 84;
const GRID = 24;
const MIN_ZOOM = 0.4;
const MAX_ZOOM = 2;

interface Viewport extends CanvasPosition {
  zoom: number;
}

type Interaction =
  | { type: "pan"; pointerId: number; clientX: number; clientY: number; origin: CanvasPosition }
  | { type: "node"; pointerId: number; nodeId: string; grab: CanvasPosition }
  | { type: "link"; pointerId: number; source: string; point: CanvasPosition };

function nodeAppearance(kind: CanvasNodeKind) {
  return match(kind)
    .with("SOURCE", () => ({ Icon: DatabaseIcon, label: "소스", tone: "informative" as const }))
    .with("TRANSFORM", () => ({ Icon: WorkflowIcon, label: "변환", tone: "brand" as const }))
    .with("JOIN", () => ({ Icon: WorkflowIcon, label: "조인", tone: "warning" as const }))
    .with("OUTPUT", () => ({ Icon: RocketIcon, label: "출력", tone: "positive" as const }))
    .exhaustive();
}

function linkPath(from: CanvasPosition, to: CanvasPosition) {
  const distance = Math.max(48, Math.abs(to.x - from.x) / 2);

  return `M ${from.x} ${from.y} C ${from.x + distance} ${from.y}, ${to.x - distance} ${to.y}, ${to.x} ${to.y}`;
}

export function Playground() {
  const { addNode, connect, disconnect, error, links, moveNode, nodes, removeNode } = useWorkflow();
  const surface = useRef<HTMLDivElement>(null);
  const [viewport, setViewport] = useState<Viewport>({ x: 64, y: 64, zoom: 1 });
  const [interaction, setInteraction] = useState<Interaction | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

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

  const fitView = () => {
    const rect = surface.current?.getBoundingClientRect();

    if (rect == null || nodes.length === 0) {
      setViewport({ x: 64, y: 64, zoom: 1 });
      return;
    }

    const left = Math.min(...nodes.map((node) => node.position.x));
    const top = Math.min(...nodes.map((node) => node.position.y));
    const right = Math.max(...nodes.map((node) => node.position.x)) + NODE_WIDTH;
    const bottom = Math.max(...nodes.map((node) => node.position.y)) + NODE_HEIGHT;
    const padding = 80;
    const zoom = clamp(
      Math.min((rect.width - padding * 2) / (right - left), (rect.height - padding * 2) / (bottom - top)),
      MIN_ZOOM,
      1,
    );

    setViewport({
      zoom,
      x: (rect.width - (right - left) * zoom) / 2 - left * zoom,
      y: (rect.height - (bottom - top) * zoom) / 2 - top * zoom,
    });
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (interaction == null || interaction.pointerId !== event.pointerId) {
      return;
    }

    match(interaction)
      .with({ type: "pan" }, (pan) =>
        setViewport((previous) => ({
          ...previous,
          x: pan.origin.x + (event.clientX - pan.clientX),
          y: pan.origin.y + (event.clientY - pan.clientY),
        })),
      )
      .with({ type: "node" }, (drag) => {
        const point = toCanvas(event.clientX, event.clientY);
        moveNode(drag.nodeId, {
          x: Math.round(point.x - drag.grab.x),
          y: Math.round(point.y - drag.grab.y),
        });
      })
      .with({ type: "link" }, (link) =>
        setInteraction({ ...link, point: toCanvas(event.clientX, event.clientY) }),
      )
      .exhaustive();
  };

  const endInteraction = (event: PointerEvent<HTMLDivElement>) => {
    if (interaction?.pointerId === event.pointerId) {
      setInteraction(null);
    }
  };

  return (
    <div className="relative flex h-full min-h-0 flex-col">
      <div
        className="bg-bg-layer-basement relative flex-1 touch-none overflow-hidden"
        onPointerDown={(event) => {
          if (event.button !== 0) {
            return;
          }

          setSelected(null);
          event.currentTarget.setPointerCapture(event.pointerId);
          setInteraction({
            type: "pan",
            pointerId: event.pointerId,
            clientX: event.clientX,
            clientY: event.clientY,
            origin: { x: viewport.x, y: viewport.y },
          });
        }}
        onPointerMove={handlePointerMove}
        onPointerUp={endInteraction}
        onPointerCancel={endInteraction}
        onWheel={(wheel: WheelEvent<HTMLDivElement>) => {
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
          backgroundSize: `${GRID * viewport.zoom}px ${GRID * viewport.zoom}px`,
          backgroundPosition: `${viewport.x}px ${viewport.y}px`,
          cursor: interaction?.type === "pan" ? "grabbing" : "grab",
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

              const path = linkPath(
                { x: from.position.x + NODE_WIDTH, y: from.position.y + NODE_HEIGHT / 2 },
                { x: to.position.x, y: to.position.y + NODE_HEIGHT / 2 },
              );

              return (
                <g key={link.id}>
                  <path
                    className="stroke-stroke-brand-solid fill-none"
                    d={path}
                    strokeWidth={2}
                  />
                  <path
                    className="pointer-events-auto cursor-pointer fill-none stroke-transparent"
                    d={path}
                    onPointerDown={(event) => {
                      event.stopPropagation();
                      disconnect(link.id);
                    }}
                    strokeWidth={16}
                  >
                    <title>연결을 지우려면 눌러요</title>
                  </path>
                </g>
              );
            })}

            {interaction?.type === "link" &&
              (() => {
                const from = nodes.find((node) => node.id === interaction.source);

                return from == null ? null : (
                  <path
                    className="stroke-stroke-brand-solid fill-none"
                    d={linkPath(
                      { x: from.position.x + NODE_WIDTH, y: from.position.y + NODE_HEIGHT / 2 },
                      interaction.point,
                    )}
                    strokeDasharray="6 6"
                    strokeWidth={2}
                  />
                );
              })()}
          </svg>

          {nodes.map((node) => {
            const { Icon, label, tone } = nodeAppearance(node.kind);

            return (
              <div
                className={cn(
                  "border-stroke-neutral-subtle bg-bg-layer-default shadow-elevation-raised group absolute rounded-surface border",
                  selected === node.id && "border-stroke-brand-solid shadow-elevation-floating",
                )}
                key={node.id}
                onPointerDown={(event) => {
                  event.stopPropagation();
                  setSelected(node.id);
                  event.currentTarget.setPointerCapture(event.pointerId);
                  const point = toCanvas(event.clientX, event.clientY);
                  setInteraction({
                    type: "node",
                    pointerId: event.pointerId,
                    nodeId: node.id,
                    grab: { x: point.x - node.position.x, y: point.y - node.position.y },
                  });
                }}
                style={{
                  height: NODE_HEIGHT,
                  left: node.position.x,
                  top: node.position.y,
                  width: NODE_WIDTH,
                  cursor: "grab",
                }}
              >
                <div className="flex h-full flex-col justify-center gap-1 px-3">
                  <div className="flex items-center gap-2">
                    <span className="text-fg-neutral-subtle [&>svg]:size-4">
                      <Icon size={16} />
                    </span>
                    <span className="text-fg-neutral truncate text-sm font-semibold">
                      {node.title}
                    </span>
                    <Badge className="ml-auto" emphasis="weak" size="small" tone={tone}>
                      {label}
                    </Badge>
                  </div>
                  <p className="text-fg-neutral-subtle truncate text-xs">
                    {node.subtitle ?? "데이터를 아직 고르지 않았어요"}
                  </p>
                </div>

                <button
                  aria-label={`${node.title} 삭제`}
                  className="text-fg-neutral-subtle hover:text-fg-critical absolute -top-3 -right-3 hidden size-6 items-center justify-center rounded-pill border border-stroke-neutral-subtle bg-bg-layer-default [&>svg]:size-3 group-hover:flex data-[visible]:flex"
                  data-visible={selected === node.id ? "" : undefined}
                  onClick={() => removeNode(node.id)}
                  onPointerDown={(event) => event.stopPropagation()}
                  type="button"
                >
                  <TrashIcon size={12} />
                </button>

                <span
                  className="border-stroke-neutral-muted bg-bg-layer-default absolute top-1/2 -left-1.5 size-3 -translate-y-1/2 rounded-pill border"
                  onPointerUp={(event) => {
                    if (interaction?.type === "link") {
                      event.stopPropagation();
                      connect(interaction.source, node.id);
                      setInteraction(null);
                    }
                  }}
                  title="입력"
                />
                <span
                  className="border-stroke-brand-solid bg-bg-layer-default absolute top-1/2 -right-1.5 size-3 -translate-y-1/2 cursor-crosshair rounded-pill border"
                  onPointerDown={(event) => {
                    event.stopPropagation();
                    setInteraction({
                      type: "link",
                      pointerId: event.pointerId,
                      source: node.id,
                      point: toCanvas(event.clientX, event.clientY),
                    });
                  }}
                  title="끌어서 다음 노드에 연결해요"
                />
              </div>
            );
          })}
        </div>

        {nodes.length === 0 && (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-3 text-center">
            <p className="text-fg-neutral text-sm font-semibold">캔버스가 비어 있어요</p>
            <p className="text-fg-neutral-muted max-w-xs text-xs">
              왼쪽에서 노드를 추가하고, 노드 오른쪽 점을 끌어서 다음 노드에 연결해요.
            </p>
            <Button
              className="pointer-events-auto"
              onClick={() => addNode("SOURCE", { x: 80, y: 120 })}
              size="small"
              variant="outline"
            >
              <DatabaseIcon />
              데이터 소스 추가
            </Button>
          </div>
        )}

        <div className="border-stroke-neutral-subtle bg-bg-layer-floating absolute bottom-4 left-4 flex items-center gap-1 rounded-pill border p-1 shadow-elevation-raised">
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
      </div>

      {error != null && (
        <div className="absolute right-4 bottom-4 max-w-sm">
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
    </div>
  );
}
