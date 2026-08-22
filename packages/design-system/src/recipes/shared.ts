export type Tone = "neutral" | "brand" | "critical" | "warning" | "positive" | "informative";

export type ControlSize = "small" | "medium" | "large";

export const controlHeightClassNames: Record<ControlSize, string> = {
  small: "h-8",
  medium: "h-10",
  large: "h-12",
};

export const controlTextClassNames: Record<ControlSize, string> = {
  small: "text-sm",
  medium: "text-sm",
  large: "text-base",
};

export const controlGapClassNames: Record<ControlSize, string> = {
  small: "gap-1",
  medium: "gap-1.5",
  large: "gap-2",
};

export const controlIconSizeClassNames: Record<ControlSize, string> = {
  small: "size-4",
  medium: "size-4",
  large: "size-5",
};

export const focusRingClassName =
  "outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stroke-focus-ring";

export const transitionClassName =
  "transition-colors duration-[var(--moby-duration-fast)] ease-standard motion-reduce:transition-none";
