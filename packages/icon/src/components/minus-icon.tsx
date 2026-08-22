import { Icon } from "../icon";
import type { IconProps } from "../types";

export const MinusIcon = (props: IconProps) => (
  <Icon {...props}>
    <svg
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M5 12h14" />
    </svg>
  </Icon>
);

MinusIcon.displayName = "MinusIcon";
