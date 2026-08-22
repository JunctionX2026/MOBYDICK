import type { Metadata } from "next";
import { ProjectList } from "./_components/project-list";

export const metadata: Metadata = { title: "프로젝트 · MOBYDICK" };

export default function ProjectsPage() {
  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-6 px-6 py-12">
      <header className="flex flex-col gap-2">
        <h1 className="text-fg-neutral text-2xl font-bold tracking-tight">프로젝트</h1>
        <p className="text-fg-neutral-muted text-sm">
          질문 하나가 프로젝트 하나예요. 프로젝트는 이 브라우저에만 저장돼요.
        </p>
      </header>
      <ProjectList />
    </main>
  );
}
