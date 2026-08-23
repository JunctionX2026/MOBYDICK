"use client";

import {
  Button,
  Callout,
  Skeleton,
  Spinner,
  Textarea,
} from "@mobydick/design-system";
import {
  parseGovDataLiveCatalog,
  parseGovDataLiveResult,
  type GovDataLiveCatalog,
  type GovDataLiveResult,
  type GovDataLiveService,
} from "@mobydick/domain";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { WorkflowDialog } from "./workflow-dialog";

interface LiveDataDialogProps {
  onOpenChange: (open: boolean) => void;
  open: boolean;
}

const selectClassName =
  "border-stroke-neutral-muted bg-bg-layer-default text-fg-neutral focus:border-stroke-brand-solid focus:ring-stroke-brand-solid h-10 rounded-control border px-3 text-sm outline-none focus:ring-2";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function errorMessage(value: unknown, fallback: string) {
  if (!isRecord(value) || !isRecord(value.error) || typeof value.error.message !== "string") {
    return fallback;
  }

  return value.error.message;
}

function formatJson(value: unknown) {
  const formatted = JSON.stringify(value, null, 2);
  return formatted ?? String(value);
}

function initialPayload(service: GovDataLiveService) {
  return JSON.stringify(
    Object.fromEntries(service.requiredParams.map((parameter) => [parameter, ""])),
    null,
    2,
  );
}

function serviceLabel(service: GovDataLiveService) {
  return `${service.name} · ${service.service}`;
}

export function LiveDataDialog({ onOpenChange, open }: LiveDataDialogProps) {
  const [catalog, setCatalog] = useState<GovDataLiveCatalog | null>(null);
  const [serviceId, setServiceId] = useState("");
  const [operation, setOperation] = useState("");
  const [payloadText, setPayloadText] = useState("{}");
  const [result, setResult] = useState<GovDataLiveResult | null>(null);
  const [loadingCatalog, setLoadingCatalog] = useState(false);
  const [loadingResult, setLoadingResult] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestRef = useRef<AbortController | null>(null);

  const selectedService = useMemo(
    () => catalog?.services.find((service) => service.service === serviceId) ?? null,
    [catalog, serviceId],
  );

  useEffect(() => {
    if (!open) {
      return;
    }

    const controller = new AbortController();
    requestRef.current = controller;
    setCatalog(null);
    setServiceId("");
    setOperation("");
    setPayloadText("{}");
    setResult(null);
    setError(null);
    setLoadingCatalog(true);
    setLoadingResult(false);

    void fetch("/api/govdata/live/catalog", { signal: controller.signal })
      .then(async (response) => {
        const payload: unknown = await response.json();

        if (!response.ok) {
          throw new Error(errorMessage(payload, "실시간 API 카탈로그를 불러오지 못했어요."));
        }

        const parsed = parseGovDataLiveCatalog(payload);

        if (parsed == null || parsed.services.length === 0) {
          throw new Error("사용할 수 있는 실시간 API가 없어요.");
        }

        setCatalog(parsed);
        const first = parsed.services[0];
        setServiceId(first.service);
        setOperation(first.defaultOperation ?? first.operations[0] ?? "");
        setPayloadText(initialPayload(first));
      })
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) {
          setError(reason instanceof Error ? reason.message : "실시간 API 카탈로그를 불러오지 못했어요.");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted && requestRef.current === controller) {
          requestRef.current = null;
          setLoadingCatalog(false);
        }
      });

    return () => {
      controller.abort();
      requestRef.current?.abort();
      requestRef.current = null;
      setLoadingCatalog(false);
      setLoadingResult(false);
    };
  }, [open]);

  const changeService = (nextServiceId: string) => {
    const nextService = catalog?.services.find((service) => service.service === nextServiceId);

    setServiceId(nextServiceId);
    setOperation(nextService?.defaultOperation ?? nextService?.operations[0] ?? "");
    setPayloadText(nextService == null ? "{}" : initialPayload(nextService));
    setResult(null);
    setError(null);
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (selectedService == null) {
      setError("호출할 실시간 API를 선택하세요.");
      return;
    }

    let parsedPayload: unknown;

    try {
      parsedPayload = JSON.parse(payloadText);
    } catch {
      setError("payload JSON을 확인해 주세요.");
      return;
    }

    if (!isRecord(parsedPayload)) {
      setError("payload는 JSON 객체여야 해요.");
      return;
    }

    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    setLoadingResult(true);
    setResult(null);
    setError(null);

    try {
      const response = await fetch("/api/govdata/live", {
        body: JSON.stringify({
          payload: parsedPayload,
          service: selectedService.service,
          ...(operation === "" ? {} : { operation }),
        }),
        headers: { "content-type": "application/json" },
        method: "POST",
        signal: controller.signal,
      });
      const responsePayload: unknown = await response.json();

      if (!response.ok) {
        throw new Error(errorMessage(responsePayload, "실시간 API 호출에 실패했어요."));
      }

      const parsedResult = parseGovDataLiveResult(responsePayload);

      if (parsedResult == null) {
        throw new Error("실시간 API 응답이 데이터 계약과 맞지 않아요.");
      }

      setResult(parsedResult);
    } catch (reason: unknown) {
      if (!controller.signal.aborted) {
        setError(reason instanceof Error ? reason.message : "실시간 API 호출에 실패했어요.");
      }
    } finally {
      if (!controller.signal.aborted && requestRef.current === controller) {
        requestRef.current = null;
        setLoadingResult(false);
      }
    }
  };

  return (
    <WorkflowDialog
      description="허용된 공공데이터 API를 한 건씩 호출하고 payload·response·records를 확인해요. 인증키는 화면과 요청 payload에 넣지 않아요."
      id="govdata-live-dialog"
      onOpenChange={onOpenChange}
      open={open}
      title="실시간 API 호출"
    >
      {loadingCatalog ? (
        <div aria-busy="true" className="flex flex-col gap-3">
          <Skeleton className="h-10 w-full" radius="control" />
          <Skeleton className="h-10 w-full" radius="control" />
          <Skeleton className="h-32 w-full" radius="control" />
        </div>
      ) : (
        <form className="flex flex-col gap-4" onSubmit={submit}>
          {catalog != null && (
            <>
              <label className="flex flex-col gap-1.5">
                <span className="text-fg-neutral text-sm font-medium">서비스</span>
                <select
                  className={selectClassName}
                  onChange={(event) => changeService(event.target.value)}
                  value={serviceId}
                >
                  {catalog.services.map((service) => (
                    <option key={service.service} value={service.service}>
                      {serviceLabel(service)}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-1.5">
                <span className="text-fg-neutral text-sm font-medium">오퍼레이션</span>
                <select
                  className={selectClassName}
                  disabled={selectedService == null || selectedService.operations.length === 0}
                  onChange={(event) => setOperation(event.target.value)}
                  value={operation}
                >
                  {selectedService?.operations.length === 0 && <option value="">기본 엔드포인트</option>}
                  {selectedService?.operations.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </label>

              {selectedService != null && selectedService.requiredParams.length > 0 && (
                <Callout tone="neutral">
                  <Callout.Content>
                    <Callout.Title>필수 payload</Callout.Title>
                    <Callout.Description>{selectedService.requiredParams.join(", ")}</Callout.Description>
                  </Callout.Content>
                </Callout>
              )}

              <label className="flex flex-col gap-1.5">
                <span className="text-fg-neutral text-sm font-medium">payload (JSON)</span>
                <Textarea
                  className="min-h-32 font-mono text-xs"
                  onChange={(event) => {
                    setPayloadText(event.target.value);
                    setResult(null);
                    setError(null);
                  }}
                  value={payloadText}
                />
              </label>
            </>
          )}

          {error != null && (
            <Callout tone="critical">
              <Callout.Content>
                <Callout.Title>실시간 API 호출이 멈췄어요</Callout.Title>
                <Callout.Description>{error}</Callout.Description>
              </Callout.Content>
            </Callout>
          )}

          <div className="flex justify-end gap-2">
            <Button onClick={() => onOpenChange(false)} size="small" type="button" variant="ghost">
              닫기
            </Button>
            <Button disabled={loadingResult || selectedService == null} size="small" type="submit">
              {loadingResult && <Spinner aria-hidden label="" size="small" variant="current" />}
              {loadingResult ? "호출 중" : "API 호출"}
            </Button>
          </div>
        </form>
      )}

      {result != null && (
        <div className="border-stroke-neutral-subtle flex flex-col gap-3 rounded-surface border p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-fg-neutral text-sm font-semibold">호출 결과</p>
            <p className="text-fg-neutral-muted text-xs">
              HTTP {result.statusCode} · {result.recordCount.toLocaleString("ko-KR")}개 레코드
              {result.totalCount == null ? "" : ` · 전체 ${result.totalCount.toLocaleString("ko-KR")}개`}
            </p>
          </div>
          <details open>
            <summary className="text-fg-neutral-muted cursor-pointer text-xs">검증된 payload</summary>
            <pre className="bg-bg-layer-default text-fg-neutral-muted mt-2 max-h-36 overflow-auto rounded-control p-2 text-[11px] leading-5">
              {formatJson(result.payload)}
            </pre>
          </details>
          <details>
            <summary className="text-fg-neutral-muted cursor-pointer text-xs">원본 response · {result.format.toUpperCase()}</summary>
            <pre className="bg-bg-layer-default text-fg-neutral-muted mt-2 max-h-48 overflow-auto rounded-control p-2 text-[11px] leading-5">
              {formatJson(result.response)}
            </pre>
          </details>
          <details>
            <summary className="text-fg-neutral-muted cursor-pointer text-xs">정규화 records 미리보기</summary>
            <pre className="bg-bg-layer-default text-fg-neutral-muted mt-2 max-h-48 overflow-auto rounded-control p-2 text-[11px] leading-5">
              {formatJson(result.records.slice(0, 10))}
            </pre>
          </details>
        </div>
      )}
    </WorkflowDialog>
  );
}
