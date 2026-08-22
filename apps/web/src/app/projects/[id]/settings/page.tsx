import type { Metadata } from "next";
import { ProjectSettingsPage } from "../_components/project-settings-page";

export const metadata: Metadata = { title: "프로젝트 설정 · MOBYDICK" };

export default async function ProjectSettingsRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return <ProjectSettingsPage projectId={id} />;
}
