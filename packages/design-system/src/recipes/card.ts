import { cva, type VariantProps } from "class-variance-authority";

export const cardRecipe = cva("rounded-surface border text-fg-neutral", {
  variants: {
    layer: {
      default: "border-stroke-neutral-subtle bg-bg-layer-default",
      floating: "border-stroke-neutral-subtle bg-bg-layer-floating shadow-elevation-floating",
    },
    selected: {
      true: "border-stroke-brand-solid",
      false: "",
    },
  },
  defaultVariants: { layer: "default", selected: false },
});

export type CardRecipeProps = VariantProps<typeof cardRecipe>;
export type CardLayer = NonNullable<CardRecipeProps["layer"]>;
