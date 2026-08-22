import { Icon } from "../icon";
import type { IconProps } from "../types";

export const CircleFilledIcon = (props: IconProps) => (
  <Icon {...props}>
    <svg
      aria-hidden="true"
      fill="currentColor"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M12 5a7 7 0 1 1 0 14a7 7 0 0 1 0 -14" />
    </svg>
  </Icon>
);

CircleFilledIcon.displayName = "CircleFilledIcon";
