import { describe, expect, it } from "vitest";
import { linkRejection, type WorkflowLink } from "./workflow";

const link = (source: string, target: string): WorkflowLink => ({
  id: `${source}-${target}`,
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
