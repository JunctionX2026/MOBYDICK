import { Icon } from "../icon";
import type { IconProps } from "../types";

export const AlertTriangleIcon = (props: IconProps) => (
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
      <path d="M10.24 4.35a2 2 0 0 1 3.52 0l6.5 12.02a2 2 0 0 1 -1.76 2.95h-13a2 2 0 0 1 -1.76 -2.95z" />
      <path d="M12 9v4" />
      <path d="M12 16h.01" />
    </svg>
  </Icon>
);

AlertTriangleIcon.displayName = "AlertTriangleIcon";
