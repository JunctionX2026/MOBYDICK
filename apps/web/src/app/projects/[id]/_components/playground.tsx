"use client";

import { Badge, Button, Callout, cn } from "@mobydick/design-system";
import {
  AffiliateIcon,
  AlertTriangleIcon,
  DatabaseIcon,
  FocusIcon,
  SendIcon,
  TransformIcon,
  ZoomInIcon,
  ZoomOutIcon,
} from "@mobydick/icon";
import { clamp } from "es-toolkit";
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
  type CanvasPosition,
  type LinkRejection,
} from "./workflow-store";

interface Viewport extends CanvasPosition {
  zoom: number;
}

interface Selection {
  nodes: ReadonlySet<string>;
  links: ReadonlySet<string>;
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
    .with("TRANSFORM", () => ({ Icon: TransformIcon, label: "변환", tone: "brand" as const }))
    .with("JOIN", () => ({ Icon: AffiliateIcon, label: "조인", tone: "warning" as const }))
    .with("OUTPUT", () => ({ Icon: SendIcon, label: "출력", tone: "positive" as const }))
    .exhaustive();
}

function outputPort(node: CanvasNode): CanvasPosition {
  return { x: node.position.x + NODE_WIDTH, y: node.position.y + NODE_HEIGHT / 2 };
}

function inputPort(node: CanvasNode): CanvasPosition {
  return { x: node.position.x, y: node.position.y + NODE_HEIGHT / 2 };
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

export function Playground() {
  const { addNode, connect, error, links, moveNodes, lastAddedId, nodes, rejectionFor, remove } =
    useWorkflow();
  const surface = useRef<HTMLDivElement>(null);
  const [viewport, setViewport] = useState<Viewport>({ x: 96, y: 96, zoom: 1 });
  const [interaction, setInteraction] = useState<Interaction | null>(null);
  const [selection, setSelection] = useState<Selection>(EMPTY_SELECTION);
  const [panMode, setPanMode] = useState(false);

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
        return;
      }

      if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault();
        remove(selection.nodes, selection.links);
        setSelection(EMPTY_SELECTION);
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

  return (
    <div className="relative flex h-full min-h-0 flex-col">
      <div
        className="bg-bg-layer-basement relative flex-1 touch-none overflow-hidden"
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

              return (
                <g key={link.id}>
                  <path
                    className={cn(
                      "fill-none",
                      isSelected ? "stroke-stroke-critical-solid" : "stroke-stroke-brand-solid",
                    )}
                    d={path}
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
                    <title>연결을 고르고 Delete를 눌러 지워요</title>
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

            return (
              <div
                className={cn(
                  "border-stroke-neutral-subtle bg-bg-layer-default shadow-elevation-raised rounded-surface absolute border transition-shadow",
                  isSelected && "border-stroke-brand-solid shadow-elevation-floating",
                  isLinkTarget &&
                    (interaction.rejection == null
                      ? "border-stroke-brand-solid"
                      : "border-stroke-critical-solid"),
                )}
                data-canvas-node={node.id}
                data-selected={isSelected}
                key={node.id}
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
                style={{
                  cursor: interaction?.type === "drag" ? "grabbing" : "grab",
                  height: NODE_HEIGHT,
                  left: node.position.x,
                  top: node.position.y,
                  width: NODE_WIDTH,
                }}
              >
                <div className="flex h-full flex-col justify-center gap-1 px-3">
                  <div className="flex items-center gap-2">
                    <span className="text-fg-neutral-subtle">
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

                <span
                  aria-hidden
                  className={cn(
                    "border-stroke-neutral-muted bg-bg-layer-default rounded-pill absolute top-1/2 -left-1.5 size-3 -translate-y-1/2 border",
                    isLinkTarget && "border-stroke-brand-solid scale-150",
                  )}
                />
                <button
                  aria-label={`${node.title}에서 연결 시작`}
                  className="border-stroke-brand-solid bg-bg-layer-default rounded-pill hover:scale-150 absolute top-1/2 -right-1.5 size-3 -translate-y-1/2 cursor-crosshair border transition-transform"
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
            <p className="text-fg-neutral-muted max-w-xs text-xs">
              왼쪽에서 노드를 추가하고, 노드 오른쪽 점을 끌어서 다음 노드에 연결해요.
            </p>
            <Button
              className="pointer-events-auto"
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
          <div className="bg-bg-layer-floating border-stroke-neutral-subtle rounded-pill shadow-elevation-raised text-fg-neutral-muted pointer-events-none absolute top-4 left-1/2 -translate-x-1/2 border px-3 py-1 text-xs">
            {rejectionMessage(interaction.rejection)}
          </div>
        )}

        <div className="border-stroke-neutral-subtle bg-bg-layer-floating rounded-pill shadow-elevation-raised absolute bottom-4 left-4 flex items-center gap-1 border p-1">
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
          <div className="border-stroke-neutral-subtle bg-bg-layer-floating rounded-pill shadow-elevation-raised text-fg-neutral-muted absolute right-4 bottom-4 flex items-center gap-2 border py-1 pr-1 pl-3 text-xs">
            <span>
              노드 {selection.nodes.size} · 연결 {selection.links.size}
            </span>
            <Button
              onClick={() => {
                remove(selection.nodes, selection.links);
                setSelection(EMPTY_SELECTION);
              }}
              shape="pill"
              size="small"
              variant="criticalSolid"
            >
              삭제
            </Button>
          </div>
        )}
      </div>

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
    </div>
  );
}
