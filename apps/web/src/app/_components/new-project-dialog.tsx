"use client";

import { Button, Callout, Input, Spinner, Textarea } from "@mobydick/design-system";
import { SparklesFilledIcon } from "@mobydick/icon";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { graphql, useMutation } from "react-relay";
import type { projectPickerCreateMutation } from "@/__generated__/relay/projectPickerCreateMutation.graphql";
import { dialogTransitionClassName, useDialogTransition } from "./dialog-transition";

const CreateProject = graphql`
  mutation projectPickerCreateMutation($input: CreateProjectInput!) {
    createProject(input: $input) {
      id
      name
      question
      phase
      updatedAt
    }
  }
`;

export interface NewProjectDialogProps {
  onOpenChange: (open: boolean) => void;
  open: boolean;
}

export function NewProjectDialog({ onOpenChange, open }: NewProjectDialogProps) {
  const router = useRouter();
  const dialogRef = useDialogTransition(open);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [create, creating] = useMutation<projectPickerCreateMutation>(CreateProject);

  useEffect(() => {
    if (open) {
      setName("");
      setDescription("");
      setError(null);
    }
  }, [open]);

  const close = () => onOpenChange(false);
  const trimmedName = name.trim();
  const trimmedDescription = description.trim();
  const canSubmit = trimmedName !== "" && trimmedDescription !== "" && !creating;

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!canSubmit) {
      return;
    }

    setError(null);
    create({
      variables: {
        input: {
          name: trimmedName,
          question: trimmedDescription,
        },
      },
      onCompleted: (response, errors) => {
        if (errors != null && errors.length > 0) {
          setError(errors[0]?.message ?? "프로젝트를 만들지 못했어요.");
          return;
        }

        router.push(`/projects/${response.createProject.id}`);
      },
      onError: (reason) => setError(reason.message),
    });
  };

  return (
    <dialog
      aria-describedby="new-project-description"
      aria-labelledby="new-project-title"
      className={`${dialogTransitionClassName} m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-surface border border-stroke-neutral-subtle bg-bg-layer-modal p-0 text-fg-neutral shadow-elevation-overlay`}
      id="new-project-dialog"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          close();
        }
      }}
      onClose={close}
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
      ref={dialogRef}
    >
      <form className="flex flex-col gap-6 p-6" onSubmit={submit}>
        <div className="flex flex-col gap-1">
          <h2 className="text-fg-neutral text-lg font-semibold" id="new-project-title">
            새 프로젝트
          </h2>
          <p className="text-fg-neutral-muted text-sm" id="new-project-description">
            작업실의 이름과 앞으로 해결할 문제를 적어주세요.
          </p>
        </div>

        <div className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-fg-neutral text-sm font-medium">프로젝트 이름</span>
            <Input
              autoFocus
              disabled={creating}
              name="name"
              onChange={(event) => setName(event.target.value)}
              placeholder="예: 경북 생활폐기물 분석"
              required
              value={name}
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-fg-neutral text-sm font-medium">설명</span>
            <span className="text-fg-neutral-muted text-xs">
              첫 줄에 사용할 데이터, 둘째 줄에 알고 싶은 결과를 적어 주세요.
            </span>
            <Textarea
              className="min-h-28"
              disabled={creating}
              name="description"
              onChange={(event) => setDescription(event.target.value)}
              placeholder={'예: 노령인구·기온·무더위쉼터 데이터를 사용합니다.\n읍면동별 폭염 취약도를 조인해 우선 대응 지역을 찾습니다.'}
              required
              value={description}
            />
          </label>
        </div>

        {error != null && (
          <Callout tone="critical">
            <Callout.Content>
              <Callout.Title>프로젝트를 만들지 못했어요</Callout.Title>
              <Callout.Description>{error}</Callout.Description>
            </Callout.Content>
          </Callout>
        )}

        <div className="flex items-center justify-end gap-2">
          <Button disabled={creating} onClick={close} size="small" type="button" variant="ghost">
            취소
          </Button>
          <Button disabled={!canSubmit} size="medium" type="submit">
            <SparklesFilledIcon />
            {creating && <Spinner aria-hidden label="" size="small" variant="current" />}
            {creating ? "분석하는 중" : "프로젝트 만들기"}
          </Button>
        </div>
      </form>
    </dialog>
  );
}
