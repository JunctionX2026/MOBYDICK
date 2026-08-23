"use client";

import { Badge, Button, Callout, Input, Skeleton } from "@mobydick/design-system";
import { ArrowRightIcon, DatabaseFilledIcon } from "@mobydick/icon";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { dialogTransitionClassName, useDialogTransition } from "@/app/_components/dialog-transition";

interface RecommendedDataset {
  datasetId: string;
  title: string;
  operation: string;
  category: string;
  provider: string;
  rows: number;
  joinableCount: number;
  confidence: "high" | "medium" | "low" | null;
  matchedColumn: string | null;
}

interface DataSourceDialogProps {
  onOpenChange: (open: boolean) => void;
  onSelect: (dataset: RecommendedDataset) => void;
  open: boolean;
  question: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value : null;
}

function numberValue(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function confidenceValue(value: unknown): RecommendedDataset["confidence"] {
  return value === "high" || value === "medium" || value === "low" ? value : null;
}

function parseDataset(value: unknown): RecommendedDataset | null {
  if (!isRecord(value)) {
    return null;
  }

  const datasetId = stringValue(value.datasetId);
  const title = stringValue(value.title);
  const operation = stringValue(value.operation);
  const category = stringValue(value.category);
  const provider = stringValue(value.provider);
  const rows = numberValue(value.rows);
  const joinableCount = numberValue(value.joinableCount);
  const confidence = value.confidence == null ? null : confidenceValue(value.confidence);
  const matchedColumn = value.matchedColumn == null ? null : stringValue(value.matchedColumn);

  if (
    datasetId == null ||
    title == null ||
    operation == null ||
    category == null ||
    provider == null ||
    rows == null ||
    joinableCount == null ||
    (value.confidence != null && confidence == null) ||
    (value.matchedColumn != null && matchedColumn == null)
  ) {
    return null;
  }

  return { datasetId, title, operation, category, provider, rows, joinableCount, confidence, matchedColumn };
}

function parseDatasets(value: unknown): RecommendedDataset[] | null {
  if (!isRecord(value) || !Array.isArray(value.datasets)) {
    return null;
  }

  const datasets: RecommendedDataset[] = [];

  for (const item of value.datasets) {
    const dataset = parseDataset(item);

    if (dataset == null) {
      return null;
    }

    datasets.push(dataset);
  }

  return datasets;
}

function formatRows(rows: number) {
  return new Intl.NumberFormat("ko-KR").format(rows);
}

function confidenceBadge(confidence: RecommendedDataset["confidence"]) {
  if (confidence === "high") {
    return { label: "높은 매칭", tone: "positive" as const };
  }

  if (confidence === "low") {
    return { label: "약한 매칭", tone: "warning" as const };
  }

  return { label: "검토 필요", tone: "neutral" as const };
}

export function DataSourceDialog({ onOpenChange, onSelect, open, question }: DataSourceDialogProps) {
  const dialogRef = useDialogTransition(open);
  const [query, setQuery] = useState(question);
  const [datasets, setDatasets] = useState<RecommendedDataset[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestRef = useRef<AbortController | null>(null);

  const load = useCallback((nextQuery: string) => {
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    setLoading(true);

    void fetch("/api/govdata/recommend", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query: nextQuery, k: 8 }),
      signal: controller.signal,
    })
      .then(async (response) => {
        const payload: unknown = await response.json();

        if (!response.ok) {
          const message = isRecord(payload) && isRecord(payload.error) ? stringValue(payload.error.message) : null;
          throw new Error(message ?? "데이터 소스를 불러오지 못했어요.");
        }

        const parsed = parseDatasets(payload);

        if (parsed == null) {
          throw new Error("데이터 소스 응답을 확인하지 못했어요.");
        }

        setDatasets(parsed);
      })
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) {
          setError(reason instanceof Error ? reason.message : "데이터 소스를 불러오지 못했어요.");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted && requestRef.current === controller) {
          requestRef.current = null;
          setLoading(false);
        }
      });

    return controller;
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }

    setQuery(question);
    setDatasets([]);
    setError(null);
    const controller = load(question);

    return () => {
      controller.abort();
      if (requestRef.current === controller) {
        requestRef.current = null;
      }
    };
  }, [load, open, question]);

  const search = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = query.trim();

    if (trimmed === "") {
      setError("질문을 입력하세요.");
      return;
    }

    setError(null);
    void load(trimmed);
  };

  return (
    <dialog
      aria-describedby="data-source-dialog-description"
      aria-labelledby="data-source-dialog-title"
      className={`${dialogTransitionClassName} m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-2xl overflow-y-auto rounded-surface border border-stroke-neutral-subtle bg-bg-layer-modal p-0 text-fg-neutral shadow-elevation-overlay`}
      id="data-source-dialog"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onOpenChange(false);
        }
      }}
      onClose={() => onOpenChange(false)}
      onCancel={(event) => {
        event.preventDefault();
        onOpenChange(false);
      }}
      ref={dialogRef}
    >
      <div className="flex flex-col gap-5 p-5">
        <div className="flex flex-col gap-1">
          <h2 className="text-fg-neutral text-lg font-semibold" id="data-source-dialog-title">
            데이터 소스 찾기
          </h2>
          <p className="text-fg-neutral-muted text-sm" id="data-source-dialog-description">
            번들의 컬럼 검색과 실측 조인 그래프에서 이 질문에 맞는 데이터를 찾아요.
          </p>
        </div>

        <form className="flex gap-2" onSubmit={search}>
          <Input className="min-w-0 flex-1" onChange={(event) => setQuery(event.target.value)} value={query} />
          <Button disabled={loading} type="submit" variant="outline">
            다시 찾기
          </Button>
        </form>

        {error != null && (
          <Callout tone="critical">
            <Callout.Icon>
              <DatabaseFilledIcon />
            </Callout.Icon>
            <Callout.Content>
              <Callout.Title>데이터 소스가 멈췄어요</Callout.Title>
              <Callout.Description>{error}</Callout.Description>
            </Callout.Content>
          </Callout>
        )}

        {loading ? (
          <div aria-busy="true" className="grid gap-3 sm:grid-cols-2">
            {[0, 1, 2, 3].map((item) => (
              <div className="border-stroke-neutral-subtle flex flex-col gap-3 rounded-surface border p-4" key={item}>
                <Skeleton className="h-5 w-4/5" />
                <Skeleton className="h-3 w-2/3" />
                <Skeleton className="h-8 w-full" radius="control" />
              </div>
            ))}
          </div>
        ) : datasets.length === 0 && error == null ? (
          <Callout tone="neutral">
            <Callout.Content>
              <Callout.Title>맞는 데이터셋을 찾지 못했어요</Callout.Title>
              <Callout.Description>질문을 조금 더 구체적으로 바꿔 다시 검색해보세요.</Callout.Description>
            </Callout.Content>
          </Callout>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {datasets.map((dataset) => {
              const badge = confidenceBadge(dataset.confidence);

              return (
                <article className="border-stroke-neutral-subtle flex flex-col gap-3 rounded-surface border p-4" key={dataset.datasetId}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="text-fg-neutral truncate text-sm font-semibold">{dataset.title}</h3>
                      <p className="text-fg-neutral-muted mt-1 line-clamp-2 text-xs">{dataset.operation}</p>
                    </div>
                    <Badge emphasis="weak" size="small" tone={badge.tone}>
                      {badge.label}
                    </Badge>
                  </div>
                  <div className="text-fg-neutral-subtle flex flex-wrap gap-x-3 gap-y-1 text-xs">
                    <span>{formatRows(dataset.rows)}행</span>
                    <span>{dataset.category}</span>
                    <span>조인 {dataset.joinableCount}개</span>
                    {dataset.matchedColumn != null && <span>컬럼 {dataset.matchedColumn}</span>}
                  </div>
                  <Button
                    className="mt-auto justify-between"
                    onClick={() => {
                      onSelect(dataset);
                      onOpenChange(false);
                    }}
                    size="small"
                    variant="outline"
                  >
                    캔버스에 추가
                    <ArrowRightIcon />
                  </Button>
                </article>
              );
            })}
          </div>
        )}

        <div className="flex justify-end">
          <Button onClick={() => onOpenChange(false)} size="small" variant="ghost">
            닫기
          </Button>
        </div>
      </div>
    </dialog>
  );
}

export type { RecommendedDataset };
