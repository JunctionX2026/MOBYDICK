import { Icon } from "../icon";
import type { IconProps } from "../types";

export const DatabaseIcon = (props: IconProps) => (
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
      <path d="M12 3c4.42 0 8 1.343 8 3s-3.58 3 -8 3s-8 -1.343 -8 -3s3.58 -3 8 -3" />
      <path d="M4 6v6c0 1.657 3.58 3 8 3s8 -1.343 8 -3v-6" />
      <path d="M4 12v6c0 1.657 3.58 3 8 3s8 -1.343 8 -3v-6" />
    </svg>
  </Icon>
);

DatabaseIcon.displayName = "DatabaseIcon";
