CREATE TABLE deployments (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  name TEXT NOT NULL,
  question TEXT NOT NULL,
  workflow TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX deployments_project_id ON deployments (project_id);

INSERT INTO deployments (id, project_id, name, question, workflow, created_at, updated_at)
SELECT deployment_id, id, name, question, workflow, created_at, updated_at
FROM projects
WHERE deployment_id IS NOT NULL;
