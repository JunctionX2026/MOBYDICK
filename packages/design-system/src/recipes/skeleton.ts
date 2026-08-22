import { variants, type VariantProps } from "../variants";

/**
 * The shimmer is a `::after` overlay sliding across the block, matching the
 * seed-design anatomy: the root paints the resting colour and the overlay
 * carries the animated gradient.
 */
export const skeletonRecipe = variants({
  base: [
    "block overflow-hidden bg-bg-skeleton",
    "after:block after:size-full after:bg-no-repeat after:content-['']",
    "after:bg-[linear-gradient(90deg,var(--moby-gradient-shimmer))]",
    "after:animate-shimmer motion-reduce:after:animate-none",
  ],
  variants: {
    radius: {
      none: "rounded-none",
      control: "rounded-control-small",
      surface: "rounded-surface",
      full: "rounded-pill",
    },
  },
  defaults: { radius: "control" },
});

export type SkeletonRecipeProps = VariantProps<typeof skeletonRecipe>;
export type SkeletonRadius = NonNullable<SkeletonRecipeProps["radius"]>;
