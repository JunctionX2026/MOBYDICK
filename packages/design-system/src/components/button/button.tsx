import { Slot } from "@radix-ui/react-slot";
import type { ComponentProps } from "react";
import { cn } from "../../cn";
import { buttonRecipe, type ButtonRecipeProps } from "../../recipes/button";

export interface ButtonProps
  extends Omit<ComponentProps<"button">, "color">,
    ButtonRecipeProps {
  asChild?: boolean;
}

export function Button({
  asChild = false,
  className,
  iconOnly,
  shape,
  size,
  type,
  variant,
  ...props
}: ButtonProps) {
  const Component = asChild ? Slot : "button";

  return (
    <Component
      className={cn(buttonRecipe({ iconOnly, shape, size, variant }), className)}
      type={asChild ? undefined : (type ?? "button")}
      {...props}
    />
  );
}
