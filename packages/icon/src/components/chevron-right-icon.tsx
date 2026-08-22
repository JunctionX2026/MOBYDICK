import { Icon } from "../icon";
import type { IconProps } from "../types";

export const ChevronRightIcon = (props: IconProps) => (
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
      <path d="M9 6l6 6l-6 6" />
    </svg>
  </Icon>
);

ChevronRightIcon.displayName = "ChevronRightIcon";
