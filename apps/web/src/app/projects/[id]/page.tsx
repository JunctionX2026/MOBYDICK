"use client";

import { deriveProjectPhase } from "@mobydick/domain";
import { Skeleton } from "@mobydick/design-system";
import { useParams, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useProjects } from "../../../lib/use-projects";

export default function ProjectPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { projects } = useProjects();

  const project = projects?.find(({ id }) => id === params.id);

  useEffect(() => {
    if (project != null) {
      router.replace(`/projects/${project.id}/${deriveProjectPhase(project)}`);
    }
  }, [project, router]);

  return <Skeleton className="h-40 w-full" radius="surface" />;
}
