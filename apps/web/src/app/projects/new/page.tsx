import type { Metadata } from "next";
import { ProjectCreateForm } from "../_components/project-create-form";

export const metadata: Metadata = { title: "프로젝트 생성 · MOBYDICK" };

export default function NewProjectPage() {
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 px-6 py-12">
      <header className="flex flex-col gap-2">
        <h1 className="text-fg-neutral text-2xl font-bold tracking-tight">프로젝트 생성</h1>
        <p className="text-fg-neutral-muted text-sm">
          답을 알고 싶은 질문을 그대로 써요. 데이터 이름을 몰라도 괜찮아요.
        </p>
      </header>
      <ProjectCreateForm />
    </main>
  );
}
