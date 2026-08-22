import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const stylesDir = join(dirname(fileURLToPath(import.meta.url)), "../styles");

function read(file: string): string {
  return readFileSync(join(stylesDir, file), "utf8");
}

function declaredNames(css: string): Set<string> {
  return new Set([...css.matchAll(/^\s*(--[\w-]+):/gm)].map((match) => match[1] as string));
}

function referencedNames(css: string): Set<string> {
  return new Set([...css.matchAll(/var\((--[\w-]+)\)/g)].map((match) => match[1] as string));
}

const palette = read("palette.css");
const semantic = read("semantic.css");
const dark = read("dark.css");
const theme = read("theme.css");

const paletteNames = declaredNames(palette);
const semanticNames = declaredNames(semantic);
const darkNames = declaredNames(dark);

const semanticColorNames = [...semanticNames].filter((name) =>
  name.startsWith("--moby-color-"),
);

describe("token layers", () => {
  it("resolves every palette reference made by the semantic layer", () => {
    const missing = [...referencedNames(semantic), ...referencedNames(dark)].filter(
      (name) => name.startsWith("--moby-color-palette-") && !paletteNames.has(name),
    );

    expect(missing).toEqual([]);
  });

  it("overrides only tokens that the light semantic layer declares", () => {
    const unknown = [...darkNames].filter((name) => !semanticNames.has(name));

    expect(unknown).toEqual([]);
  });

  it("gives every semantic color a dark counterpart", () => {
    const uncovered = semanticColorNames.filter((name) => !darkNames.has(name));

    expect(uncovered).toEqual([]);
  });

  it("resolves every token the Tailwind theme exposes", () => {
    const known = new Set([...paletteNames, ...semanticNames]);
    const missing = [...referencedNames(theme)].filter((name) => !known.has(name));

    expect(missing).toEqual([]);
  });

  it("keeps the semantic layer free of raw color values", () => {
    const rawValues = [...semantic.matchAll(/^\s*(--moby-color-[\w-]+):\s*([^;]+);/gm)]
      .filter(([, name]) => !(name as string).startsWith("--moby-color-palette-"))
      .filter(([, , value]) => !(value as string).trim().startsWith("var("))
      .map(([, name]) => name as string);

    expect(rawValues).toEqual([
      "--moby-color-bg-transparent-pressed",
      "--moby-color-bg-transparent-selected",
      "--moby-color-bg-transparent-selected-pressed",
      "--moby-color-bg-overlay",
    ]);
  });
});
