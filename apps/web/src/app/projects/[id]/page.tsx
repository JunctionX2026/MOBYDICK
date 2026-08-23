import type { Metadata } from "next";
import { ProjectShell } from "./_components/project-shell";

export const metadata: Metadata = { title: "프로젝트" };

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return <ProjectShell projectId={id} />;
}
