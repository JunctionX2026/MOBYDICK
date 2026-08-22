import { Icon } from "../icon";
import type { IconProps } from "../types";

export const SparkleFilledIcon = (props: IconProps) => (
  <Icon {...props}>
    <svg
      aria-hidden="true"
      fill="currentColor"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M12 2.5c.4 0 .76.24.92.6l1.62 3.71a4 4 0 0 0 2.05 2.05l3.71 1.62a1 1 0 0 1 0 1.84l-3.71 1.62a4 4 0 0 0 -2.05 2.05l-1.62 3.71a1 1 0 0 1 -1.84 0l-1.62 -3.71a4 4 0 0 0 -2.05 -2.05l-3.71 -1.62a1 1 0 0 1 0 -1.84l3.71 -1.62a4 4 0 0 0 2.05 -2.05l1.62 -3.71c.16 -.36.52 -.6.92 -.6" />
    </svg>
  </Icon>
);

SparkleFilledIcon.displayName = "SparkleFilledIcon";
