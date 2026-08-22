import { variants, type VariantProps } from "../variants";
import { focusRingClassName, transitionClassName } from "./shared";

const field = [
  "rounded-control w-full text-sm",
  "bg-bg-layer-default text-fg-neutral placeholder:text-fg-neutral-subtle",
  "border border-stroke-neutral-subtle hover:not-disabled:border-stroke-neutral",
  "disabled:bg-bg-disabled disabled:text-fg-disabled disabled:cursor-not-allowed",
  focusRingClassName,
  transitionClassName,
];

const invalidVariant = {
  invalid: {
    true: "border-stroke-critical-solid",
    false: "",
  },
} as const;

export const inputRecipe = variants({
  base: [...field, "h-9 px-3"],
  variants: invalidVariant,
  defaults: { invalid: false },
});

export const textareaRecipe = variants({
  base: [...field, "resize-y px-3 py-2.5"],
  variants: invalidVariant,
  defaults: { invalid: false },
});

export type FieldRecipeProps = VariantProps<typeof inputRecipe>;
