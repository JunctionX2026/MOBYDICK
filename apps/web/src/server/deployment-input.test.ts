import { describe, expect, it } from "vitest";
import { resolvePayloadSchema } from "./deployment-input";

describe("resolvePayloadSchema", () => {
  const storedSchema = {
    type: "object",
    properties: { region: { column: "key" } },
  };

  it("uses the stored schema when the request sends the documented empty object", () => {
    expect(resolvePayloadSchema({}, storedSchema)).toEqual(storedSchema);
  });

  it("prefers a non-empty request schema over the stored schema", () => {
    const requestSchema = { type: "object", properties: { total: { column: "total" } } };

    expect(resolvePayloadSchema(requestSchema, storedSchema)).toEqual(requestSchema);
  });

  it("does not send an empty stored schema to GovData", () => {
    expect(resolvePayloadSchema(undefined, {})).toBeUndefined();
  });
});
