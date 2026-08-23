import { describe, expect, it } from "vitest";
import { parseWorkflow, linkRejection, type WorkflowLink } from "./workflow";

const storedSpec = {
  sources: [
    {
      alias: "a",
      dataset_id: "dataset_1",
      filters: [],
      metrics: [{ name: "total", agg: "count", column: "*" }],
      group_by: [],
    },
  ],
  order_by: [],
  limit: 100,
};

const link = (source: string, target: string): WorkflowLink => ({
  id: `${source}-${target}`,
  intent: null,
  source,
  target,
});

describe("linkRejection", () => {
  it("allows a link that extends the pipe forward", () => {
    expect(linkRejection([link("a", "b")], "b", "c")).toBeNull();
  });

  it("allows two sources to fan into one node", () => {
    expect(linkRejection([link("a", "c")], "b", "c")).toBeNull();
  });

  it("refuses a node linking to itself", () => {
    expect(linkRejection([], "a", "a")).toBe("self");
  });

  it("refuses the same direction twice", () => {
    expect(linkRejection([link("a", "b")], "a", "b")).toBe("duplicate");
  });

  it("allows the reverse of an existing link to be reported as a cycle", () => {
    expect(linkRejection([link("a", "b")], "b", "a")).toBe("cycle");
  });

  it("refuses a link that closes a longer loop", () => {
    expect(linkRejection([link("a", "b"), link("b", "c")], "c", "a")).toBe("cycle");
  });

  it("terminates when the existing links already contain a loop", () => {
    expect(linkRejection([link("a", "b"), link("b", "a")], "b", "c")).toBeNull();
  });
});

describe("parseWorkflow", () => {
  const nodes = [
    {
      id: "a",
      kind: "source",
      title: "Source",
      subtitle: null,
      datasetId: "dataset_1",
      position: { x: 0, y: 0 },
    },
    {
      id: "b",
      kind: "output",
      title: "Output",
      subtitle: null,
      datasetId: null,
      position: { x: 200, y: 0 },
    },
  ];

  it("rejects duplicate node and link ids", () => {
    expect(parseWorkflow({ nodes: [...nodes, nodes[0]], links: [] })).toBeNull();
    expect(
      parseWorkflow({
        nodes,
        links: [link("a", "b"), { ...link("a", "b"), id: "a-b-copy" }],
      }),
    ).toBeNull();
    expect(
      parseWorkflow({
        nodes,
        links: [link("a", "b"), { ...link("a", "b"), source: "b", target: "a" }],
      }),
    ).toBeNull();
  });

  it("keeps stored execution settings at the workflow boundary", () => {
    expect(
      parseWorkflow({
        nodes: [],
        links: [],
        operationSpec: storedSpec,
        requestData: { region: "포항시" },
        payloadSchema: {
          type: "object",
          properties: { total: { column: "total" } },
        },
      }),
    ).toEqual({
      nodes: [],
      links: [],
      operationSpec: {
        sources: [
          {
            alias: "a",
            datasetId: "dataset_1",
            filters: [],
            metrics: [{ name: "total", aggregation: "count", column: "*" }],
            groupBy: [],
          },
        ],
        orderBy: [],
        limit: 100,
      },
      requestData: { region: "포항시" },
      payloadSchema: {
        type: "object",
        properties: { total: { column: "total" } },
      },
    });
  });

  it("rejects malformed deployment settings", () => {
    expect(parseWorkflow({ nodes: [], links: [], operationSpec: { sources: [] } })).toBeNull();
    expect(parseWorkflow({ nodes: [], links: [], requestData: [] })).toBeNull();
    expect(parseWorkflow({ nodes: [], links: [], payloadSchema: "object" })).toBeNull();
  });
});
