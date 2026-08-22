import { Icon } from "../icon";
import type { IconProps } from "../types";

export const ChevronUpIcon = (props: IconProps) => (
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
      <path d="M6 15l6 -6l6 6" />
    </svg>
  </Icon>
);

ChevronUpIcon.displayName = "ChevronUpIcon";
