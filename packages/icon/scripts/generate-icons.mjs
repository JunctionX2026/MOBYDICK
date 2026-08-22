import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const tablerIcons = resolve(dirname(require.resolve("@tabler/icons/outline/database.svg")), "..");
const outputDirectory = join(packageRoot, "src/components");

const VARIANT_SUFFIX = { outline: "", filled: "Filled" };

const ATTRIBUTE_NAMES = {
  "clip-rule": "clipRule",
  "fill-rule": "fillRule",
  "stroke-dasharray": "strokeDasharray",
  "stroke-linecap": "strokeLinecap",
  "stroke-linejoin": "strokeLinejoin",
  "stroke-width": "strokeWidth",
};

/** Tabler prefixes every icon with a transparent 24x24 hit area we do not need. */
const HIT_AREA = /<path\s+stroke="none"\s+d="M0 0h24v24H0z"\s+fill="none"\s*\/>/;

function toKebabCase(value) {
  return value.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
}

function toJsxAttributes(raw) {
  return raw.replace(/([a-zA-Z-]+)="([^"]*)"/g, (match, name, value) => {
    if (name === "xmlns") {
      return match;
    }

    return `${ATTRIBUTE_NAMES[name] ?? name}="${value}"`;
  });
}

async function readTablerIcon(variant, source) {
  const path = join(tablerIcons, variant, `${source}.svg`);
  const svg = await readFile(path, "utf8").catch(() => {
    throw new Error(`Tabler has no ${variant} icon named "${source}".`);
  });

  const root = svg.match(/<svg([^>]*)>([\s\S]*)<\/svg>/);

  if (root == null) {
    throw new Error(`Could not parse ${path}.`);
  }

  const attributes = root[1]
    .replace(/\s*class="[^"]*"/, "")
    .replace(/\s*width="[^"]*"/, "")
    .replace(/\s*height="[^"]*"/, "");

  const body = root[2]
    .replace(HIT_AREA, "")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => `      ${toJsxAttributes(line)}`)
    .join("\n");

  return { attributes: toJsxAttributes(attributes).replace(/\s+/g, " ").trim(), body };
}

function renderComponent(componentName, icon, source, variant) {
  return `import { Icon } from "../icon";
import type { IconProps } from "../types";

/** Generated from the Tabler ${variant} icon "${source}". Run \`pnpm generate\` to update. */
export const ${componentName} = (props: IconProps) => (
  <Icon {...props}>
    <svg aria-hidden="true" ${icon.attributes}>
${icon.body}
    </svg>
  </Icon>
);

${componentName}.displayName = "${componentName}";
`;
}

async function generate() {
  const manifest = JSON.parse(await readFile(join(packageRoot, "icons.json"), "utf8"));

  await rm(outputDirectory, { force: true, recursive: true });
  await mkdir(outputDirectory, { recursive: true });

  const names = [];

  for (const [source, entry] of Object.entries(manifest)) {
    for (const variant of entry.variants) {
      const componentName = `${entry.name}${VARIANT_SUFFIX[variant]}Icon`;
      const fileName = `${toKebabCase(componentName)}.tsx`;

      await writeFile(
        join(outputDirectory, fileName),
        renderComponent(componentName, await readTablerIcon(variant, source), source, variant),
        "utf8",
      );

      names.push(fileName.replace(/\.tsx$/, ""));
    }
  }

  const barrel = names
    .sort()
    .map((name) => `export * from "./${name}";`)
    .join("\n");

  await writeFile(join(outputDirectory, "index.ts"), `${barrel}\n`, "utf8");

  console.log(`Generated ${(await readdir(outputDirectory)).length - 1} icons from Tabler.`);
}

await generate();
