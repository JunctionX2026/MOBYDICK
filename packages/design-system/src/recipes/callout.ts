import { variants, type VariantProps } from "../variants";
import type { Tone } from "./shared";

export const calloutRootRecipe = variants({
  base: "flex w-full gap-2.5 rounded-surface border p-3.5 text-sm",
  variants: {
    tone: {
      neutral: [
        "border-stroke-neutral-subtle bg-bg-neutral-weak",
        "[&_[data-callout-icon]]:text-fg-neutral-muted [&_[data-callout-title]]:text-fg-neutral",
      ],
      brand: [
        "border-stroke-brand-weak bg-bg-brand-weak",
        "[&_[data-callout-icon]]:text-fg-brand [&_[data-callout-title]]:text-fg-brand",
      ],
      critical: [
        "border-stroke-critical-weak bg-bg-critical-weak",
        "[&_[data-callout-icon]]:text-fg-critical [&_[data-callout-title]]:text-fg-critical",
      ],
      warning: [
        "border-stroke-warning-weak bg-bg-warning-weak",
        "[&_[data-callout-icon]]:text-fg-warning [&_[data-callout-title]]:text-fg-warning",
      ],
      positive: [
        "border-stroke-positive-weak bg-bg-positive-weak",
        "[&_[data-callout-icon]]:text-fg-positive [&_[data-callout-title]]:text-fg-positive",
      ],
      informative: [
        "border-stroke-informative-weak bg-bg-informative-weak",
        "[&_[data-callout-icon]]:text-fg-informative [&_[data-callout-title]]:text-fg-informative",
      ],
    } satisfies Record<Tone, string[]>,
  },
  defaults: { tone: "neutral" },
});

export const calloutIconClassName = "mt-0.5 inline-flex size-4 shrink-0 [&>svg]:size-full";

export const calloutContentClassName = "flex min-w-0 flex-col gap-1";

export const calloutTitleClassName = "font-semibold";

export const calloutDescriptionClassName = "text-fg-neutral-muted";

export type CalloutRecipeProps = VariantProps<typeof calloutRootRecipe>;
export type CalloutTone = NonNullable<CalloutRecipeProps["tone"]>;
