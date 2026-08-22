import type { ComponentProps } from "react";
import { cn } from "../../cn";
import { cardRecipe, type CardRecipeProps } from "../../recipes/card";

export interface CardProps extends ComponentProps<"div">, CardRecipeProps {}

function CardRoot({ className, layer, selected, ...props }: CardProps) {
  return <div className={cn(cardRecipe({ layer, selected }), className)} {...props} />;
}

function CardHeader({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("flex flex-col gap-1 p-4 pb-2", className)} {...props} />;
}

function CardTitle({ className, ...props }: ComponentProps<"h3">) {
  return <h3 className={cn("text-sm font-semibold text-fg-neutral", className)} {...props} />;
}

function CardDescription({ className, ...props }: ComponentProps<"p">) {
  return <p className={cn("text-xs text-fg-neutral-muted", className)} {...props} />;
}

function CardBody({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("p-4 pt-2", className)} {...props} />;
}

function CardFooter({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn("flex items-center gap-2 border-t border-stroke-neutral-subtle p-4", className)}
      {...props}
    />
  );
}

export const Card = Object.assign(CardRoot, {
  Body: CardBody,
  Description: CardDescription,
  Footer: CardFooter,
  Header: CardHeader,
  Title: CardTitle,
});
