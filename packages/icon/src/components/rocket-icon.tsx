import { Icon } from "../icon";
import type { IconProps } from "../types";

export const RocketIcon = (props: IconProps) => (
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
      <path d="M4 13a8 8 0 0 1 7 -7a6 6 0 0 1 6 6a8 8 0 0 1 -7 7l-1 -3l-2 -2z" />
      <path d="M7 14a6 6 0 0 0 -3 6a6 6 0 0 0 6 -3" />
      <path d="M15 9h.01" />
    </svg>
  </Icon>
);

RocketIcon.displayName = "RocketIcon";
