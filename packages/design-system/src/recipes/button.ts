import { variants, type VariantProps } from "../variants";
import { focusRingClassName, transitionClassName } from "./shared";

export const buttonRecipe = variants({
  base: [
    "relative inline-flex shrink-0 cursor-pointer items-center justify-center whitespace-nowrap",
    "border border-transparent font-medium",
    focusRingClassName,
    transitionClassName,
    "disabled:pointer-events-none disabled:cursor-not-allowed",
    "disabled:bg-bg-disabled disabled:text-fg-disabled disabled:border-transparent",
    "[&_svg]:pointer-events-none [&_svg]:shrink-0",
  ],
  variants: {
    variant: {
      brandSolid: "bg-bg-brand-solid text-fg-brand-contrast hover:bg-bg-brand-solid-pressed",
      neutralWeak: "bg-bg-neutral-weak text-fg-neutral hover:bg-bg-neutral-weak-pressed",
      criticalSolid:
        "bg-bg-critical-solid text-fg-critical-contrast hover:bg-bg-critical-solid-pressed",
      outline:
        "border-stroke-neutral-muted bg-transparent text-fg-neutral hover:bg-bg-transparent-pressed",
      ghost: "bg-transparent text-fg-neutral hover:bg-bg-transparent-pressed",
    },
    size: {
      small: "h-8 gap-1 rounded-control-small px-2.5 text-sm [&_svg]:size-4",
      medium: "h-10 gap-1.5 rounded-control px-3.5 text-sm [&_svg]:size-4",
      large: "h-12 gap-2 rounded-control px-4 text-base [&_svg]:size-5",
    },
    shape: {
      square: "",
      pill: "rounded-pill",
    },
    iconOnly: {
      true: "aspect-square px-0",
      false: "",
    },
  },
  compound: [
    { iconOnly: true, size: "small", class: "w-8" },
    { iconOnly: true, size: "medium", class: "w-10" },
    { iconOnly: true, size: "large", class: "w-12" },
  ],
  defaults: {
    variant: "brandSolid",
    size: "medium",
    shape: "square",
    iconOnly: false,
  },
});

export type ButtonRecipeProps = VariantProps<typeof buttonRecipe>;
export type ButtonVariant = NonNullable<ButtonRecipeProps["variant"]>;
export type ButtonSize = NonNullable<ButtonRecipeProps["size"]>;
export type ButtonShape = NonNullable<ButtonRecipeProps["shape"]>;
