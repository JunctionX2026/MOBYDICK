import { describe, expect, it } from "vitest";
import { badgeRecipe } from "./recipes/badge";
import { buttonRecipe } from "./recipes/button";
import { cardRecipe } from "./recipes/card";
import { variants } from "./variants";

const recipe = variants({
  base: "base",
  variants: {
    tone: { neutral: "tone-neutral", brand: "tone-brand" },
    size: { small: "size-small", large: ["size-large", "size-large-extra"] },
    active: { true: "is-active", false: "" },
  },
  compound: [{ tone: "brand", size: "large", class: "brand-large" }],
  defaults: { tone: "neutral", size: "small", active: false },
});

describe("variants", () => {
  it("applies defaults when a selection is omitted", () => {
    expect(recipe()).toBe("base tone-neutral size-small");
    expect(recipe({})).toBe("base tone-neutral size-small");
  });

  it("treats an explicit undefined as omitted", () => {
    expect(recipe({ tone: undefined })).toBe(recipe());
  });

  it("overrides only the selected variant", () => {
    expect(recipe({ tone: "brand" })).toBe("base tone-brand size-small");
  });

  it("flattens array values", () => {
    expect(recipe({ size: "large" })).toBe("base tone-neutral size-large size-large-extra");
  });

  it("maps a true/false option set to a boolean prop", () => {
    expect(recipe({ active: true })).toContain("is-active");
    expect(recipe({ active: false })).not.toContain("is-active");
  });

  it("applies a compound rule only when every condition matches", () => {
    expect(recipe({ tone: "brand", size: "large" })).toContain("brand-large");
    expect(recipe({ tone: "brand", size: "small" })).not.toContain("brand-large");
    expect(recipe({ tone: "neutral", size: "large" })).not.toContain("brand-large");
  });

  it("applies a compound rule against a defaulted value", () => {
    const withDefault = variants({
      variants: {
        tone: { neutral: "tone-neutral", brand: "tone-brand" },
        size: { small: "size-small", large: "size-large" },
      },
      compound: [{ tone: "neutral", size: "small", class: "matched" }],
      defaults: { tone: "neutral", size: "small" },
    });

    expect(withDefault()).toContain("matched");
  });

  it("omits classes for a variant with no default and no selection", () => {
    const optional = variants({
      base: "base",
      variants: { tone: { neutral: "tone-neutral" } },
    });

    expect(optional()).toBe("base");
    expect(optional({ tone: "neutral" })).toBe("base tone-neutral");
  });
});

describe("recipes", () => {
  it("pairs badge tone with emphasis", () => {
    expect(badgeRecipe({ tone: "critical", emphasis: "solid" })).toContain("bg-bg-critical-solid");
    expect(badgeRecipe({ tone: "critical", emphasis: "weak" })).toContain("bg-bg-critical-weak");
    expect(badgeRecipe()).toContain("bg-bg-neutral-weak");
  });

  it("sizes an icon-only button as a square", () => {
    expect(buttonRecipe({ iconOnly: true, size: "small" })).toContain("w-8");
    expect(buttonRecipe({ iconOnly: false, size: "small" })).not.toContain("w-8");
    expect(buttonRecipe()).toContain("bg-bg-brand-solid");
  });

  it("marks a selected card with the brand stroke", () => {
    expect(cardRecipe({ selected: true })).toContain("border-stroke-brand-solid");
    expect(cardRecipe()).not.toContain("border-stroke-brand-solid");
  });
});
