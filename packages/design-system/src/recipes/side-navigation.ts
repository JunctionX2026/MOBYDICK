import { focusRingClassName } from "./shared";

const collapseTransition =
  "duration-[var(--moby-duration-medium)] ease-standard motion-reduce:transition-none";

/**
 * Slots read the collapsed state off `data-side-navigation-state` on the root
 * instead of receiving it as a prop. A slot deep in the tree then needs no
 * context and no variant of its own.
 */
const collapsed = "group-data-[side-navigation-state=collapsed]/side-navigation";

export const sideNavigationRootClassName = [
  "group/side-navigation relative flex h-full shrink-0 flex-col overflow-x-hidden",
  "border-r border-stroke-neutral-subtle bg-bg-layer-side-navigation text-fg-neutral",
  "transition-[width]",
  collapseTransition,
].join(" ");

export const sideNavigationHeaderClassName =
  "relative flex min-h-14 shrink-0 items-center gap-2 px-3 py-2";

export const sideNavigationTriggerClassName = [
  "absolute top-2 right-2 inline-flex size-9 cursor-pointer items-center justify-center",
  "rounded-control-small text-fg-neutral-subtle hover:bg-bg-transparent-pressed hover:text-fg-neutral",
  `${collapsed}:top-11 ${collapsed}:right-1/2 ${collapsed}:translate-x-1/2`,
  "[&>svg]:size-4",
  focusRingClassName,
  "transition-[color,background-color,top,right,transform]",
  collapseTransition,
].join(" ");

export const sideNavigationContentClassName = [
  "flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overflow-x-hidden px-2 pt-2 pb-6",
  "[scrollbar-width:thin]",
  `${collapsed}:gap-0 ${collapsed}:px-2.5 ${collapsed}:[scrollbar-width:none]`,
  "transition-[gap,padding]",
  collapseTransition,
].join(" ");

export const sideNavigationFooterClassName = [
  "flex shrink-0 flex-col gap-0.5 border-t border-stroke-neutral-subtle p-2 empty:hidden",
  `${collapsed}:px-2.5`,
  "transition-[padding]",
  collapseTransition,
].join(" ");

export const sideNavigationGroupClassName = "flex shrink-0 flex-col gap-0.5";

/**
 * Collapsing lifts the label out of flow with a negative margin rather than
 * hiding it, so the items below slide up instead of jumping.
 */
export const sideNavigationGroupLabelClassName = [
  "pointer-events-none flex h-8 shrink-0 items-center truncate px-2",
  "text-xs font-semibold text-fg-neutral-subtle",
  `${collapsed}:-mt-8 ${collapsed}:opacity-0`,
  "transition-[margin,opacity]",
  collapseTransition,
].join(" ");

/**
 * Hover, selected and focus paint on a `::before` layer so the item can scale
 * on press without the background lagging behind the transform.
 */
export const sideNavigationItemClassName = [
  "group/side-navigation-item relative flex h-10 w-full cursor-pointer items-center",
  "overflow-hidden rounded-control px-2 text-left outline-none",
  "before:absolute before:inset-0 before:rounded-control before:transition-colors",
  "before:duration-[var(--moby-duration-fast)] before:ease-standard",
  "hover:before:bg-bg-transparent-pressed",
  "active:scale-[0.99]",
  "data-[current]:before:bg-bg-transparent-selected",
  "data-[current]:hover:before:bg-bg-transparent-selected-pressed",
  "focus-visible:before:outline-2 focus-visible:before:-outline-offset-2",
  "focus-visible:before:outline-stroke-focus-ring",
  "data-[disabled]:pointer-events-none data-[disabled]:cursor-not-allowed",
  "transition-transform duration-[var(--moby-duration-fast)] ease-standard",
  "motion-reduce:transition-none",
].join(" ");

export const sideNavigationItemPrefixIconClassName = [
  "pointer-events-none absolute top-1/2 left-2 z-10 inline-flex size-5 shrink-0 -translate-y-1/2",
  "items-center justify-center text-fg-neutral-subtle",
  "group-data-[current]/side-navigation-item:text-fg-neutral",
  "group-data-[disabled]/side-navigation-item:text-fg-disabled",
  "transition-colors",
  collapseTransition,
  "[&>svg]:size-full",
].join(" ");

export const sideNavigationItemLabelClassName = [
  "relative z-10 min-w-0 flex-1 truncate pl-9 text-sm font-medium text-fg-neutral-muted",
  "group-data-[current]/side-navigation-item:text-fg-neutral",
  "group-data-[disabled]/side-navigation-item:text-fg-disabled",
  `${collapsed}:opacity-0`,
  "transition-[color,opacity]",
  collapseTransition,
].join(" ");

export const sideNavigationItemSuffixClassName = [
  "relative z-10 ml-2 inline-flex shrink-0 items-center text-fg-neutral-subtle",
  `${collapsed}:opacity-0`,
  "transition-opacity",
  collapseTransition,
  "[&>svg]:size-4",
].join(" ");

export const sideNavigationInsetClassName = "flex min-w-0 flex-1 flex-col overflow-hidden";
