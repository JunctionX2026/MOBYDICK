import { Icon } from "../icon";
import type { IconProps } from "../types";

export const ArrowRightIcon = (props: IconProps) => (
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
      <path d="M13 6l6 6l-6 6" />
    </svg>
  </Icon>
);

ArrowRightIcon.displayName = "ArrowRightIcon";
