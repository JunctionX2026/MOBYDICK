import { describe, expect, it } from "vitest";
import { createProject, deriveProjectPhase, parseProject } from "./project";
import { parseWorkflow, type WorkflowNode } from "./workflow";

const question = "경북에서 생활폐기물이 인구 대비 많은 시군이 어디야?";

const node = (id: string): WorkflowNode => ({
  id,
  kind: "source",
  title: "생활폐기물 배출량",
  subtitle: null,
  datasetId: null,
  position: { x: 0, y: 0 },
});

describe("deriveProjectPhase", () => {
  const project = createProject({ question });
  const composed = { ...project, workflow: { nodes: [node("a")], links: [] } };

  it.each([
    ["discover", project],
    ["compose", composed],
    ["serve", { ...project, deploymentId: "dep_1" }],
    ["serve", { ...composed, deploymentId: "dep_1" }],
  ])("reads %s off the content", (phase, value) => {
    expect(deriveProjectPhase(value)).toBe(phase);
  });
});

describe("parseWorkflow", () => {
  it("keeps a canvas that links two of its own nodes", () => {
    const workflow = {
      nodes: [node("a"), node("b")],
      links: [{ id: "l1", intent: null, source: "a", target: "b" }],
    };

    expect(parseWorkflow(workflow)).toEqual(workflow);
  });

  it.each([
    ["an unknown node kind", { nodes: [{ ...node("a"), kind: "merge" }], links: [] }],
    ["a node without a position", { nodes: [{ ...node("a"), position: undefined }], links: [] }],
    ["a non-numeric position", { nodes: [{ ...node("a"), position: { x: "0", y: 0 } }], links: [] }],
    ["a link to a missing node", { nodes: [node("a")], links: [{ id: "l1", source: "a", target: "b" }] }],
    ["a link to itself", { nodes: [node("a")], links: [{ id: "l1", source: "a", target: "a" }] }],
    ["a missing links array", { nodes: [] }],
  ])("rejects %s", (_label, value) => {
    expect(parseWorkflow(value)).toBeNull();
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
    ["a broken workflow", { ...stored, workflow: { nodes: [{ id: "a" }], links: [] } }],
    ["a non-object", "project"],
    ["an array", []],
  ])("rejects %s", (_label, value) => {
    expect(parseProject(value)).toBeNull();
  });
});
