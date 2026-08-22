import { parseProject, type Project } from "@mobydick/domain";

const STORAGE_KEY = "mobydick.projects.v1";

export type ProjectStoreError = "unavailable" | "corrupt" | "quota";

export interface ProjectsSnapshot {
  projects: Project[];
  dropped: number;
  error: ProjectStoreError | null;
}

function storage() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function loadProjects(): ProjectsSnapshot {
  const store = storage();

  if (store == null) {
    return { projects: [], dropped: 0, error: "unavailable" };
  }

  const raw = store.getItem(STORAGE_KEY);

  if (raw == null) {
    return { projects: [], dropped: 0, error: null };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { projects: [], dropped: 0, error: "corrupt" };
  }

  if (!Array.isArray(parsed)) {
    return { projects: [], dropped: 0, error: "corrupt" };
  }

  const projects = parsed.map(parseProject).filter((project): project is Project => project != null);

  return { projects, dropped: parsed.length - projects.length, error: null };
}

export function saveProjects(projects: Project[]): ProjectStoreError | null {
  const store = storage();

  if (store == null) {
    return "unavailable";
  }

  try {
    store.setItem(STORAGE_KEY, JSON.stringify(projects));
    return null;
  } catch {
    return "quota";
  }
}

export function byNewestFirst(a: Project, b: Project) {
  return b.updatedAt.localeCompare(a.updatedAt);
}
