"use client";

import { Button, Callout, Input, Skeleton, Spinner, Textarea } from "@mobydick/design-system";
import { ArrowRightIcon } from "@mobydick/icon";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { graphql, useLazyLoadQuery, useMutation } from "react-relay";
import type { projectSettingsPageQuery } from "@/__generated__/relay/projectSettingsPageQuery.graphql";
import type { projectSettingsPageRenameMutation } from "@/__generated__/relay/projectSettingsPageRenameMutation.graphql";
import type { projectSettingsPageSaveMutation } from "@/__generated__/relay/projectSettingsPageSaveMutation.graphql";
import { ClientQuery } from "@/relay/client-query";

const ProjectSettingsQuery = graphql`
  query projectSettingsPageQuery($id: ID!) {
    project(id: $id) {
      id
      name
      question
      workflow {
        nodes {
          id
          kind
          title
          subtitle
          datasetId
          position {
            x
            y
          }
        }
        links {
          id
          source
          target
        }
        operationSpecJson
        requestDataJson
        payloadSchemaJson
      }
    }
  }
`;

const SaveWorkflow = graphql`
  mutation projectSettingsPageSaveMutation($input: SaveWorkflowInput!) {
    saveWorkflow(input: $input) {
      id
      name
      phase
      updatedAt
    }
  }
`;

const RenameProject = graphql`
  mutation projectSettingsPageRenameMutation($input: RenameProjectInput!) {
    renameProject(input: $input) {
      id
      name
      updatedAt
    }
  }
`;

function isJsonObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseJsonObject(text: string, label: string, allowBlank = false) {
  if (allowBlank && text.trim() === "") {
    return null;
  }

  try {
    const value: unknown = JSON.parse(text);
    return isJsonObject(value) ? value : `${label}은 JSON 객체여야 해요.`;
  } catch {
    return `${label} JSON을 확인해 주세요.`;
  }
}

function jsonText(value: string | null, fallback: Record<string, unknown> | null) {
  if (value == null || value.trim() === "") {
    return fallback == null ? "" : JSON.stringify(fallback, null, 2);
  }

  try {
    const parsed: unknown = JSON.parse(value);
    return JSON.stringify(parsed, null, 2);
  } catch {
    return value;
  }
}

function SettingsSkeleton() {
  return (
    <main className="bg-bg-layer-basement flex min-h-dvh items-start justify-center px-4 py-8 sm:px-8">
      <div className="w-full max-w-3xl space-y-5">
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-8 w-52" />
        <Skeleton className="h-96 w-full" radius="surface" />
      </div>
    </main>
  );
}

function SettingsContent({ projectId }: { projectId: string }) {
  const router = useRouter();
  const data = useLazyLoadQuery<projectSettingsPageQuery>(ProjectSettingsQuery, { id: projectId }, { fetchPolicy: "store-and-network" });
  const [saveWorkflow, savingWorkflow] = useMutation<projectSettingsPageSaveMutation>(SaveWorkflow);
  const [renameProject, renaming] = useMutation<projectSettingsPageRenameMutation>(RenameProject);
  const project = data.project;
  const [name, setName] = useState(project?.name ?? "");
  const [requestData, setRequestData] = useState(() => jsonText(project?.workflow.requestDataJson ?? null, {}));
  const [payloadSchema, setPayloadSchema] = useState(() => jsonText(project?.workflow.payloadSchemaJson ?? null, null));
  const [error, setError] = useState<string | null>(null);
  const saving = savingWorkflow || renaming;

  if (project == null) {
    return (
      <main className="bg-bg-layer-basement flex min-h-dvh items-center justify-center px-6">
        <div className="w-full max-w-md">
          <Callout tone="critical">
            <Callout.Content>
              <Callout.Title>프로젝트를 찾을 수 없어요</Callout.Title>
              <Callout.Description>주소가 바뀌었거나 프로젝트가 지워졌어요.</Callout.Description>
            </Callout.Content>
          </Callout>
          <Button asChild className="mt-4" size="small" variant="outline">
            <Link href="/">모든 프로젝트</Link>
          </Button>
        </div>
      </main>
    );
  }

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedName = name.trim();
    const parsedRequestData = parseJsonObject(requestData, "요청 데이터");
    const parsedPayloadSchema = parseJsonObject(payloadSchema, "payload 스키마", true);

    if (trimmedName === "") {
      setError("프로젝트 이름을 입력하세요.");
      return;
    }

    if (typeof parsedRequestData === "string") {
      setError(parsedRequestData);
      return;
    }

    if (typeof parsedPayloadSchema === "string") {
      setError(parsedPayloadSchema);
      return;
    }

    setError(null);
    saveWorkflow({
      variables: {
        input: {
          id: project.id,
          links: project.workflow.links,
          nodes: project.workflow.nodes,
          operationSpecJson: project.workflow.operationSpecJson,
          payloadSchemaJson: parsedPayloadSchema == null ? null : JSON.stringify(parsedPayloadSchema),
          requestDataJson: JSON.stringify(parsedRequestData),
        },
      },
      onCompleted: (_response, errors) => {
        if (errors != null && errors.length > 0) {
          setError(errors[0]?.message ?? "실행 설정을 저장하지 못했어요.");
          return;
        }

        if (trimmedName === project.name) {
          router.push(`/projects/${project.id}`);
          return;
        }

        renameProject({
          variables: { input: { id: project.id, name: trimmedName } },
          onCompleted: (_renameResponse, renameErrors) => {
            if (renameErrors != null && renameErrors.length > 0) {
              setError(renameErrors[0]?.message ?? "프로젝트 이름을 바꾸지 못했어요.");
              return;
            }

            router.push(`/projects/${project.id}`);
          },
          onError: (reason) => setError(reason.message),
        });
      },
      onError: (reason) => setError(reason.message),
    });
  };

  return (
    <main className="bg-bg-layer-basement min-h-dvh px-4 py-6 sm:px-8 sm:py-10">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <header className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <Link className="text-fg-neutral-muted hover:text-fg-neutral text-sm" href={`/projects/${project.id}`}>
              ← 캔버스로 돌아가기
            </Link>
            <h1 className="text-fg-neutral mt-4 text-2xl font-semibold">프로젝트 설정</h1>
            <p className="text-fg-neutral-muted mt-1 text-sm">{project.question}</p>
          </div>
          <span className="bg-bg-layer-floating text-fg-neutral-muted shrink-0 rounded-pill px-3 py-1 text-xs">API · MCP</span>
        </header>

        <form className="border-stroke-neutral-muted bg-bg-layer-floating shadow-elevation-floating flex flex-col gap-6 rounded-surface border p-5 sm:p-6" onSubmit={submit}>
          <label className="flex flex-col gap-1.5">
            <span className="text-fg-neutral text-sm font-medium">프로젝트 이름</span>
            <Input disabled={saving} onChange={(event) => setName(event.target.value)} value={name} />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-fg-neutral text-sm font-medium">요청 데이터 기본값 (JSON)</span>
            <span className="text-fg-neutral-muted text-xs">배포 API와 MCP 호출에 사용할 기본 요청 객체예요.</span>
            <Textarea
              className="min-h-44 font-mono text-xs"
              disabled={saving}
              onChange={(event) => setRequestData(event.target.value)}
              spellCheck={false}
              value={requestData}
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-fg-neutral text-sm font-medium">payload 스키마 (JSON)</span>
            <span className="text-fg-neutral-muted text-xs">결과를 JSON 객체로 만들 때 사용할 기본 스키마예요. 비워두면 표 결과를 그대로 반환해요.</span>
            <Textarea
              className="min-h-56 font-mono text-xs"
              disabled={saving}
              onChange={(event) => setPayloadSchema(event.target.value)}
              placeholder={'{\n  "type": "object",\n  "properties": {}\n}'}
              spellCheck={false}
              value={payloadSchema}
            />
          </label>

          {project.workflow.operationSpecJson == null && (
            <Callout tone="warning">
              <Callout.Content>
                <Callout.Title>아직 저장된 실행 파이프라인이 없어요</Callout.Title>
                <Callout.Description>캔버스에서 질문 분석이 끝난 뒤 저장하면 API와 MCP가 같은 파이프라인을 실행해요.</Callout.Description>
              </Callout.Content>
            </Callout>
          )}

          {error != null && <p className="text-fg-critical text-sm">{error}</p>}

          <div className="flex items-center justify-between gap-3">
            <Button asChild size="small" variant="ghost">
              <Link href={`/projects/${project.id}`}>취소</Link>
            </Button>
            <Button disabled={saving} size="small" type="submit">
              {saving && <Spinner aria-hidden label="" size="small" variant="current" />}
              저장하고 캔버스로
              {!saving && <ArrowRightIcon />}
            </Button>
          </div>
        </form>
      </div>
    </main>
  );
}

export function ProjectSettingsPage({ projectId }: { projectId: string }) {
  return <ClientQuery fallback={<SettingsSkeleton />}><SettingsContent projectId={projectId} /></ClientQuery>;
}
