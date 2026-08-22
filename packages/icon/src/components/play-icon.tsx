import { Icon } from "../icon";
import type { IconProps } from "../types";

export const PlayIcon = (props: IconProps) => (
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
      <path d="M7 4v16l13 -8z" />
    </svg>
  </Icon>
);

PlayIcon.displayName = "PlayIcon";
