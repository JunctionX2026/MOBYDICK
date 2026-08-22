"use client";

import type { Project } from "@mobydick/domain";
import { useCallback, useEffect, useState } from "react";
import {
  byNewestFirst,
  loadProjects,
  saveProjects,
  type ProjectStoreError,
} from "./project-store";

export interface ProjectsState {
  projects: Project[] | null;
  dropped: number;
  error: ProjectStoreError | null;
}

/**
 * `projects` stays null until the first client read so the UI can show a
 * skeleton instead of an empty state the user would misread as "no projects".
 */
export function useProjects() {
  const [state, setState] = useState<ProjectsState>({
    projects: null,
    dropped: 0,
    error: null,
  });

  useEffect(() => {
    const snapshot = loadProjects();

    setState({
      projects: [...snapshot.projects].sort(byNewestFirst),
      dropped: snapshot.dropped,
      error: snapshot.error,
    });
  }, []);

  const replace = useCallback((next: Project[]) => {
    const error = saveProjects(next);

    setState((previous) => ({
      ...previous,
      projects: [...next].sort(byNewestFirst),
      error,
    }));

    return error;
  }, []);

  return { ...state, replace };
}
