import { variants, type VariantProps } from "../variants";
import { focusRingClassName } from "./shared";

const collapseTransition =
  "transition-[width,opacity,margin,padding] duration-[var(--moby-duration-medium)] ease-standard motion-reduce:transition-none";

export const sideNavigationRootRecipe = variants({
  base: [
    "flex h-full shrink-0 flex-col overflow-x-hidden",
    "border-r border-stroke-neutral-subtle bg-bg-layer-default",
    collapseTransition,
  ],
  variants: {
    collapsed: {
      true: "w-14",
      false: "w-60",
    },
  },
  defaults: { collapsed: false },
});

export const sideNavigationHeaderClassName = "flex min-h-16 shrink-0 items-center gap-2 p-2";

export const sideNavigationContentClassName =
  "flex flex-1 flex-col gap-2 overflow-y-auto px-2 pt-2 pb-6";

export const sideNavigationFooterClassName = "shrink-0 p-2 empty:hidden";

export const sideNavigationGroupClassName = "flex flex-col";

/**
 * Collapsing lifts the label out of flow with a negative margin rather than
 * hiding it, so the items below slide up instead of jumping.
 */
export const sideNavigationGroupLabelRecipe = variants({
  base: ["pointer-events-none truncate p-1.5 text-xs font-bold text-fg-neutral-muted", collapseTransition],
  variants: {
    collapsed: {
      true: "-mt-[calc(1lh+0.75rem)] opacity-0",
      false: "opacity-100",
    },
  },
  defaults: { collapsed: false },
});

export const sideNavigationItemRecipe = variants({
  base: [
    "group/item relative flex h-11 w-full cursor-pointer items-center overflow-hidden rounded-control text-left",
    "hover:bg-bg-transparent-pressed",
    "aria-[current]:bg-bg-transparent-selected",
    "aria-[current]:hover:bg-bg-transparent-selected-pressed",
    "disabled:cursor-not-allowed disabled:hover:bg-transparent",
    focusRingClassName,
    collapseTransition,
  ],
  variants: {
    collapsed: {
      true: "px-2.5",
      false: "px-2",
    },
  },
  defaults: { collapsed: false },
});

export const sideNavigationItemIconClassName = [
  "absolute top-1/2 size-5 shrink-0 -translate-y-1/2",
  "text-fg-neutral-subtle",
  "group-aria-[current]/item:text-fg-neutral",
  "group-disabled/item:text-fg-disabled",
  "[&>svg]:size-full",
].join(" ");

export const sideNavigationItemLabelRecipe = variants({
  base: [
    "min-w-0 grow truncate p-1.5 pl-8 text-sm font-medium",
    "text-fg-neutral-muted",
    "group-aria-[current]/item:text-fg-neutral",
    "group-disabled/item:text-fg-disabled",
    collapseTransition,
  ],
  variants: {
    collapsed: {
      true: "opacity-0",
      false: "opacity-100",
    },
  },
  defaults: { collapsed: false },
});

export type SideNavigationRootRecipeProps = VariantProps<typeof sideNavigationRootRecipe>;
