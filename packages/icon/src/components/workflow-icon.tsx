import { Icon } from "../icon";
import type { IconProps } from "../types";

export const WorkflowIcon = (props: IconProps) => (
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
      <path d="M3 5h6v4h-6z" />
      <path d="M15 15h6v4h-6z" />
      <path d="M15 5h6v4h-6z" />
      <path d="M9 7h3a3 3 0 0 1 3 3v7" />
      <path d="M15 7h-0.01" />
    </svg>
  </Icon>
);

WorkflowIcon.displayName = "WorkflowIcon";
