import { cva, type VariantProps } from "class-variance-authority";
import type { Tone } from "./shared";

export const badgeRecipe = cva(
  "inline-flex w-fit shrink-0 items-center gap-1 whitespace-nowrap rounded-pill font-medium [&_svg]:size-3",
  {
    variants: {
      tone: {
        neutral: "",
        brand: "",
        critical: "",
        warning: "",
        positive: "",
        informative: "",
      } satisfies Record<Tone, string>,
      emphasis: {
        solid: "",
        weak: "",
      },
      size: {
        small: "h-5 px-1.5 text-xs",
        medium: "h-6 px-2 text-xs",
      },
    },
    compoundVariants: [
      { tone: "neutral", emphasis: "solid", class: "bg-bg-neutral-solid text-fg-neutral-inverted" },
      { tone: "brand", emphasis: "solid", class: "bg-bg-brand-solid text-fg-brand-contrast" },
      {
        tone: "critical",
        emphasis: "solid",
        class: "bg-bg-critical-solid text-fg-critical-contrast",
      },
      { tone: "warning", emphasis: "solid", class: "bg-bg-warning-solid text-fg-warning-contrast" },
      {
        tone: "positive",
        emphasis: "solid",
        class: "bg-bg-positive-solid text-fg-positive-contrast",
      },
      {
        tone: "informative",
        emphasis: "solid",
        class: "bg-bg-informative-solid text-fg-informative-contrast",
      },
      { tone: "neutral", emphasis: "weak", class: "bg-bg-neutral-weak text-fg-neutral-muted" },
      { tone: "brand", emphasis: "weak", class: "bg-bg-brand-weak text-fg-brand" },
      { tone: "critical", emphasis: "weak", class: "bg-bg-critical-weak text-fg-critical" },
      { tone: "warning", emphasis: "weak", class: "bg-bg-warning-weak text-fg-warning" },
      { tone: "positive", emphasis: "weak", class: "bg-bg-positive-weak text-fg-positive" },
      { tone: "informative", emphasis: "weak", class: "bg-bg-informative-weak text-fg-informative" },
    ],
    defaultVariants: { tone: "neutral", emphasis: "weak", size: "medium" },
  },
);

export type BadgeRecipeProps = VariantProps<typeof badgeRecipe>;
export type BadgeTone = NonNullable<BadgeRecipeProps["tone"]>;
export type BadgeEmphasis = NonNullable<BadgeRecipeProps["emphasis"]>;
export type BadgeSize = NonNullable<BadgeRecipeProps["size"]>;
