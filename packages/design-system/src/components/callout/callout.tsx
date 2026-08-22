import type { ComponentProps } from "react";
import { cn } from "../../cn";
import {
  calloutContentClassName,
  calloutDescriptionClassName,
  calloutIconClassName,
  calloutRootRecipe,
  calloutTitleClassName,
  type CalloutTone,
} from "../../recipes/callout";

export interface CalloutProps extends ComponentProps<"div"> {
  tone?: CalloutTone;
}

function CalloutRoot({ className, tone = "neutral", ...props }: CalloutProps) {
  return <div className={cn(calloutRootRecipe({ tone }), className)} data-tone={tone} {...props} />;
}

function CalloutIcon({ className, ...props }: ComponentProps<"span">) {
  return (
    <span
      aria-hidden="true"
      className={cn(calloutIconClassName, className)}
      data-callout-icon=""
      {...props}
    />
  );
}

function CalloutContent({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn(calloutContentClassName, className)} {...props} />;
}

function CalloutTitle({ className, ...props }: ComponentProps<"p">) {
  return <p className={cn(calloutTitleClassName, className)} data-callout-title="" {...props} />;
}

function CalloutDescription({ className, ...props }: ComponentProps<"p">) {
  return <p className={cn(calloutDescriptionClassName, className)} {...props} />;
}

export const Callout = Object.assign(CalloutRoot, {
  Content: CalloutContent,
  Description: CalloutDescription,
  Icon: CalloutIcon,
  Title: CalloutTitle,
});
