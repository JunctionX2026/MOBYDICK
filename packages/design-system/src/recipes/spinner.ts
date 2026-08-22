import { variants, type VariantProps } from "../variants";

export const spinnerRecipe = variants({
  base: "moby-spinner relative block shrink-0 pointer-events-none",
  variants: {
    variant: {
      current: "text-current",
      primary: "text-fg-brand",
      secondary: "text-fg-neutral-muted",
      success: "text-fg-positive",
      error: "text-fg-critical",
      warning: "text-fg-warning",
      info: "text-fg-informative",
      white: "text-fg-neutral-inverted",
    },
  },
  defaults: { variant: "primary" },
});

export type SpinnerRecipeProps = VariantProps<typeof spinnerRecipe>;
