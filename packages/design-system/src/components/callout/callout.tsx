import type { ComponentProps } from "react";
import { cn } from "../../cn";
import {
  calloutContentRecipe,
  calloutDescriptionRecipe,
  calloutIconRecipe,
  calloutRootRecipe,
  calloutTitleRecipe,
  type CalloutTone,
} from "../../recipes/callout";

export interface CalloutProps extends ComponentProps<"div"> {
  tone?: CalloutTone;
}

function CalloutRoot({ className, tone = "neutral", ...props }: CalloutProps) {
  return (
    <div className={cn(calloutRootRecipe({ tone }), className)} data-tone={tone} {...props} />
  );
}

function CalloutIcon({ className, ...props }: ComponentProps<"span">) {
  return (
    <span
      aria-hidden="true"
      className={cn(calloutIconRecipe(), className)}
      data-callout-icon=""
      {...props}
    />
  );
}

function CalloutContent({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn(calloutContentRecipe(), className)} {...props} />;
}

function CalloutTitle({ className, ...props }: ComponentProps<"p">) {
  return <p className={cn(calloutTitleRecipe(), className)} data-callout-title="" {...props} />;
}

function CalloutDescription({ className, ...props }: ComponentProps<"p">) {
  return <p className={cn(calloutDescriptionRecipe(), className)} {...props} />;
}

export const Callout = Object.assign(CalloutRoot, {
  Content: CalloutContent,
  Description: CalloutDescription,
  Icon: CalloutIcon,
  Title: CalloutTitle,
});
