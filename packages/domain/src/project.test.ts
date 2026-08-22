import { describe, expect, it } from "vitest";
import {
  createProject,
  deriveProjectPhase,
  parseProject,
  projectNameFromQuestion,
  touchProject,
} from "./project";
import { isUlid, ulid } from "./ulid";

const question = "경북에서 생활폐기물이 인구 대비 많은 시군이 어디야?";

describe("ulid", () => {
  it("produces sortable identifiers", () => {
    const earlier = ulid(1_700_000_000_000);
    const later = ulid(1_700_000_001_000);

    expect(earlier < later).toBe(true);
  });

  it("accepts only its own format", () => {
    expect(isUlid(ulid())).toBe(true);
    expect(isUlid("01K39QW2M5B7X0YFTN4C8REJD")).toBe(false);
    expect(isUlid("01k39qw2m5b7x0yftn4c8rejd1")).toBe(false);
    expect(isUlid("01K39QW2M5B7X0YFTN4C8REJDU")).toBe(false);
  });
});

describe("projectNameFromQuestion", () => {
  it("collapses whitespace", () => {
    expect(projectNameFromQuestion("  경북   폐기물 \n 질문 ")).toBe("경북 폐기물 질문");
  });

  it("truncates a long question", () => {
    const name = projectNameFromQuestion("가".repeat(60));

    expect(name).toHaveLength(41);
    expect(name.endsWith("…")).toBe(true);
  });
});

describe("createProject", () => {
  it("starts empty with the question as the name", () => {
    const project = createProject({ question, now: new Date("2026-08-22T00:00:00.000Z") });

    expect(project.workflow).toEqual({ nodes: [], links: [] });
    expect(project.deploymentId).toBeNull();
    expect(project.question).toBe(question);
    expect(project.createdAt).toBe(project.updatedAt);
    expect(isUlid(project.id)).toBe(true);
  });

  it("refuses a blank question", () => {
    expect(() => createProject({ question: "   " })).toThrow();
  });
});

describe("deriveProjectPhase", () => {
  const project = createProject({ question });

  it("starts at discover", () => {
    expect(deriveProjectPhase(project)).toBe("discover");
  });

  it("moves to compose once the canvas has a node", () => {
    const composing = { ...project, workflow: { nodes: [{ id: "a" }], links: [] } };

    expect(deriveProjectPhase(composing)).toBe("compose");
  });

  it("moves to serve once deployed, whatever the canvas holds", () => {
    const served = { ...project, deploymentId: "dep_1" };

    expect(deriveProjectPhase(served)).toBe("serve");
  });
});

describe("parseProject", () => {
  const stored = JSON.parse(JSON.stringify(createProject({ question })));

  it("accepts a round-tripped project", () => {
    expect(parseProject(stored)).toEqual(stored);
  });

  it.each([
    ["a missing id", { ...stored, id: undefined }],
    ["a non-ULID id", { ...stored, id: "project-1" }],
    ["a blank name", { ...stored, name: "  " }],
    ["a blank question", { ...stored, question: "" }],
    ["an unparsable timestamp", { ...stored, updatedAt: "yesterday" }],
    ["a missing workflow", { ...stored, workflow: undefined }],
    ["a workflow node without an id", { ...stored, workflow: { nodes: [{}], links: [] } }],
    ["a non-object", "project"],
    ["an array", []],
  ])("rejects %s", (_label, value) => {
    expect(parseProject(value)).toBeNull();
  });
});

describe("touchProject", () => {
  it("moves updatedAt but leaves createdAt alone", () => {
    const project = createProject({ question, now: new Date("2026-08-22T00:00:00.000Z") });
    const renamed = touchProject(project, { name: "새 이름" }, new Date("2026-08-23T00:00:00.000Z"));

    expect(renamed.name).toBe("새 이름");
    expect(renamed.createdAt).toBe(project.createdAt);
    expect(renamed.updatedAt).toBe("2026-08-23T00:00:00.000Z");
  });
});
