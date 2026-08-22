import type { ComponentProps } from "react";
import { cn } from "../../cn";
import { textareaRecipe, type FieldRecipeProps } from "../../recipes/field";

export interface TextareaProps
  extends Omit<ComponentProps<"textarea">, "children">,
    FieldRecipeProps {}

export function Textarea({ className, invalid, ...props }: TextareaProps) {
  return (
    <textarea
      aria-invalid={invalid || undefined}
      className={cn(textareaRecipe({ invalid }), className)}
      {...props}
    />
  );
}
