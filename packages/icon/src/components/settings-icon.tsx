import { Icon } from "../icon";
import type { IconProps } from "../types";

export const SettingsIcon = (props: IconProps) => (
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
      <path d="M10.325 4.317a1.724 1.724 0 0 1 3.35 0a1.724 1.724 0 0 0 2.573 1.066a1.724 1.724 0 0 1 2.37 2.37a1.724 1.724 0 0 0 1.065 2.572a1.724 1.724 0 0 1 0 3.35a1.724 1.724 0 0 0 -1.066 2.573a1.724 1.724 0 0 1 -2.37 2.37a1.724 1.724 0 0 0 -2.572 1.065a1.724 1.724 0 0 1 -3.35 0a1.724 1.724 0 0 0 -2.573 -1.066a1.724 1.724 0 0 1 -2.37 -2.37a1.724 1.724 0 0 0 -1.065 -2.572a1.724 1.724 0 0 1 0 -3.35a1.724 1.724 0 0 0 1.066 -2.573a1.724 1.724 0 0 1 2.37 -2.37a1.724 1.724 0 0 0 2.572 -1.065" />
      <path d="M12 9a3 3 0 1 0 0 6a3 3 0 0 0 0 -6" />
    </svg>
  </Icon>
);

SettingsIcon.displayName = "SettingsIcon";
