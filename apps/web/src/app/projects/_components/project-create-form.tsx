"use client";

import { createProject } from "@mobydick/domain";
import { Button, Callout, Textarea } from "@mobydick/design-system";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useProjects } from "../../../lib/use-projects";

const EXAMPLE = "경북에서 생활폐기물이 인구 대비 많은 시군이 어디야?";

export function ProjectCreateForm() {
  const router = useRouter();
  const { error, projects, replace } = useProjects();
  const [question, setQuestion] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const blank = question.trim() === "";
  const disabled = projects == null || error === "unavailable";

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);

    if (blank || projects == null) {
      return;
    }

    const project = createProject({ question });

    if (replace([...projects, project]) != null) {
      return;
    }

    router.push(`/projects/${project.id}`);
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
      {error === "unavailable" && (
        <Callout tone="critical">
          <Callout.Content>
            <Callout.Title>프로젝트를 저장할 수 없어요</Callout.Title>
            <Callout.Description>
              이 브라우저가 로컬 저장소를 막고 있어서 만들어도 남지 않아요.
            </Callout.Description>
          </Callout.Content>
        </Callout>
      )}
      {error === "quota" && (
        <Callout tone="critical">
          <Callout.Content>
            <Callout.Title>저장 공간이 가득 찼어요</Callout.Title>
            <Callout.Description>
              <Link className="underline" href="/projects">
                프로젝트 목록
              </Link>
              에서 쓰지 않는 프로젝트를 지워요.
            </Callout.Description>
          </Callout.Content>
        </Callout>
      )}

      <label className="flex flex-col gap-2" htmlFor="question">
        <span className="text-fg-neutral text-sm font-medium">질문</span>
        <Textarea
          id="question"
          invalid={submitted && blank}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder={EXAMPLE}
          rows={4}
          value={question}
        />
        {submitted && blank && (
          <span className="text-fg-critical text-xs">질문을 써야 프로젝트를 만들 수 있어요.</span>
        )}
      </label>

      <div className="flex gap-2">
        <Button disabled={disabled} type="submit">
          만들기
        </Button>
        <Button asChild variant="ghost">
          <Link href="/projects">취소</Link>
        </Button>
      </div>
    </form>
  );
}
