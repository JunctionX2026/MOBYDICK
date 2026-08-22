import { Children, cloneElement, isValidElement } from "react";
import type { IconProps } from "./types";

const DEFAULT_SIZE = 16;

/**
 * Every icon renders through this wrapper so the size prop and the
 * `aria-hidden` fallback stay identical across the set. An icon is hidden from
 * assistive technology unless the call site gives it an accessible name.
 */
export function Icon({ children, height, size = DEFAULT_SIZE, width, ...props }: IconProps) {
  const child = Children.only(children);

  if (!isValidElement<IconProps>(child)) {
    return null;
  }

  const labelled = props["aria-label"] != null || props["aria-labelledby"] != null;

  return cloneElement(child, {
    width: width ?? size,
    height: height ?? size,
    "aria-hidden": props["aria-hidden"] ?? !labelled,
    ...props,
  });
}
