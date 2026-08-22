import type { ComponentProps } from "react";

type IconProps = ComponentProps<"svg">;

function Icon(props: IconProps) {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      focusable="false"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.75}
      viewBox="0 0 24 24"
      {...props}
    />
  );
}

export function OverviewIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect height="7" rx="1.5" width="7" x="3" y="3" />
      <rect height="7" rx="1.5" width="7" x="14" y="3" />
      <rect height="7" rx="1.5" width="7" x="3" y="14" />
      <rect height="7" rx="1.5" width="7" x="14" y="14" />
    </Icon>
  );
}

export function DiscoverIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.6-3.6" />
    </Icon>
  );
}

export function ComposeIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="6" cy="6" r="2.5" />
      <circle cx="18" cy="12" r="2.5" />
      <circle cx="6" cy="18" r="2.5" />
      <path d="M8.2 7.2 15.8 11M15.8 13 8.2 16.8" />
    </Icon>
  );
}

export function ServeIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect height="6" rx="2" width="18" x="3" y="4" />
      <rect height="6" rx="2" width="18" x="3" y="14" />
      <path d="M7 7h.01M7 17h.01" />
    </Icon>
  );
}

export function PlusIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 5v14M5 12h14" />
    </Icon>
  );
}

export function CollapseIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M15 6l-6 6 6 6" />
    </Icon>
  );
}
