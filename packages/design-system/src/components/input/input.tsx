import type { ComponentProps } from "react";
import { cn } from "../../cn";
import { inputRecipe, type FieldRecipeProps } from "../../recipes/field";

export interface InputProps
  extends Omit<ComponentProps<"input">, "children" | "size">,
    FieldRecipeProps {}

export function Input({ className, invalid, ...props }: InputProps) {
  return (
    <input
      aria-invalid={invalid || undefined}
      className={cn(inputRecipe({ invalid }), className)}
      {...props}
    />
  );
}
