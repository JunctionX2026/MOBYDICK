import { describe, expect, it } from "vitest";
import { cn } from "./cn";
import { cardRecipe } from "./recipes/card";

describe("cn", () => {
  it("keeps the last value when custom theme utilities collide", () => {
    expect(cn("rounded-surface", "rounded-pill")).toBe("rounded-pill");
    expect(cn("shadow-elevation-raised", "shadow-elevation-overlay")).toBe(
      "shadow-elevation-overlay",
    );
    expect(cn("rounded-control", "rounded-control-small")).toBe("rounded-control-small");
  });

  it("keeps the last value when semantic colors collide", () => {
    expect(cn("bg-bg-brand-solid", "bg-bg-critical-weak")).toBe("bg-bg-critical-weak");
    expect(cn("text-fg-neutral", "text-fg-critical")).toBe("text-fg-critical");
    expect(cn("border-stroke-neutral-subtle", "border-stroke-critical-weak")).toBe(
      "border-stroke-critical-weak",
    );
  });

  it("treats font size and text color as separate concerns", () => {
    expect(cn("text-sm text-fg-neutral")).toBe("text-sm text-fg-neutral");
    expect(cn("text-sm text-fg-neutral", "text-xs")).toBe("text-fg-neutral text-xs");
  });

  it("resolves conditional and falsy inputs through clsx", () => {
    expect(cn("p-4", false && "p-8", null, undefined, ["gap-2"])).toBe("p-4 gap-2");
    expect(cn("p-4", true && "p-8")).toBe("p-8");
  });

  it("lets a caller override recipe defaults", () => {
    const merged = cn(cardRecipe({ layer: "floating" }), "rounded-pill bg-bg-brand-weak");

    expect(merged).not.toContain("rounded-surface");
    expect(merged).not.toContain("bg-bg-layer-floating");
    expect(merged).toContain("rounded-pill");
    expect(merged).toContain("bg-bg-brand-weak");
    expect(merged).toContain("shadow-elevation-floating");
  });
});
