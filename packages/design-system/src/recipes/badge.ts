import { variants, type VariantProps } from "../variants";
import type { Tone } from "./shared";

export type BadgeEmphasis = "solid" | "weak";

const toneClassNames = {
  solid: {
    neutral: "bg-bg-neutral-solid text-fg-neutral-inverted",
    brand: "bg-bg-brand-solid text-fg-brand-contrast",
    critical: "bg-bg-critical-solid text-fg-critical-contrast",
    warning: "bg-bg-warning-solid text-fg-warning-contrast",
    positive: "bg-bg-positive-solid text-fg-positive-contrast",
    informative: "bg-bg-informative-solid text-fg-informative-contrast",
  },
  weak: {
    neutral: "bg-bg-neutral-weak text-fg-neutral-muted",
    brand: "bg-bg-brand-weak text-fg-brand",
    critical: "bg-bg-critical-weak text-fg-critical",
    warning: "bg-bg-warning-weak text-fg-warning",
    positive: "bg-bg-positive-weak text-fg-positive",
    informative: "bg-bg-informative-weak text-fg-informative",
  },
} satisfies Record<BadgeEmphasis, Record<Tone, string>>;

const emptyByTone = {
  neutral: "",
  brand: "",
  critical: "",
  warning: "",
  positive: "",
  informative: "",
} satisfies Record<Tone, string>;

export const badgeRecipe = variants({
  base: "inline-flex w-fit shrink-0 items-center gap-1 whitespace-nowrap rounded-pill font-medium [&_svg]:size-3",
  variants: {
    tone: emptyByTone,
    emphasis: { solid: "", weak: "" },
    size: {
      small: "h-5 px-1.5 text-xs",
      medium: "h-6 px-2 text-xs",
    },
  },
  compound: (Object.keys(toneClassNames) as BadgeEmphasis[]).flatMap((emphasis) =>
    (Object.keys(toneClassNames[emphasis]) as Tone[]).map((tone) => ({
      emphasis,
      tone,
      class: toneClassNames[emphasis][tone],
    })),
  ),
  defaults: { tone: "neutral", emphasis: "weak", size: "medium" },
});

export type BadgeRecipeProps = VariantProps<typeof badgeRecipe>;
export type BadgeTone = NonNullable<BadgeRecipeProps["tone"]>;
export type BadgeSize = NonNullable<BadgeRecipeProps["size"]>;
