import type { ComponentProps } from "react";
import { cn } from "../../cn";
import { skeletonRecipe, type SkeletonRecipeProps } from "../../recipes/skeleton";

export interface SkeletonProps extends ComponentProps<"div">, SkeletonRecipeProps {}

export function Skeleton({ className, radius, ...props }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={cn(skeletonRecipe({ radius }), className)}
      data-skeleton=""
      {...props}
    />
  );
}
