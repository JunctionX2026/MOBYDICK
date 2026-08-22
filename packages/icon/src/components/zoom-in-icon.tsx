import { Icon } from "../icon";
import type { IconProps } from "../types";

export const ZoomInIcon = (props: IconProps) => (
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
      <path d="M10 3a7 7 0 1 0 0 14a7 7 0 0 0 0 -14" />
      <path d="M7 10h6" />
      <path d="M10 7v6" />
      <path d="M21 21l-6 -6" />
    </svg>
  </Icon>
);

ZoomInIcon.displayName = "ZoomInIcon";
