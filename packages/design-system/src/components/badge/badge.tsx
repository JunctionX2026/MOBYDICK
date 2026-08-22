import type { ComponentProps } from "react";
import { cn } from "../../cn";
import { badgeRecipe, type BadgeRecipeProps } from "../../recipes/badge";

export interface BadgeProps extends ComponentProps<"span">, BadgeRecipeProps {}

export function Badge({ className, emphasis, size, tone, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeRecipe({ emphasis, size, tone }), className)} {...props} />
  );
}
