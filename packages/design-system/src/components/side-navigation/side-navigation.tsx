"use client";

import { Slot } from "@radix-ui/react-slot";
import { cloneElement, isValidElement, type ComponentProps, type ReactElement, type ReactNode } from "react";
import { buildContext, useControlledState } from "react-simplikit";
import { cn } from "../../cn";
import {
  sideNavigationContentClassName,
  sideNavigationFooterClassName,
  sideNavigationGroupClassName,
  sideNavigationGroupLabelRecipe,
  sideNavigationHeaderClassName,
  sideNavigationItemIconClassName,
  sideNavigationItemLabelRecipe,
  sideNavigationItemRecipe,
  sideNavigationRootRecipe,
} from "../../recipes/side-navigation";

const [SideNavigationProvider, useSideNavigation] = buildContext<{
  collapsed: boolean;
  setCollapsed: (collapsed: boolean) => void;
}>("SideNavigation", { collapsed: false, setCollapsed: () => {} });

export interface SideNavigationProps extends Omit<ComponentProps<"nav">, "onChange"> {
  collapsed?: boolean;
  defaultCollapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
}

function SideNavigationRoot({
  collapsed: collapsedProp,
  defaultCollapsed = false,
  onCollapsedChange,
  className,
  children,
  ...props
}: SideNavigationProps) {
  const [collapsed, setCollapsed] = useControlledState({
    value: collapsedProp,
    defaultValue: defaultCollapsed,
    onChange: onCollapsedChange,
  });

  return (
    <SideNavigationProvider collapsed={collapsed} setCollapsed={setCollapsed}>
      <nav
        className={cn(sideNavigationRootRecipe({ collapsed }), className)}
        data-collapsed={collapsed ? "" : undefined}
        {...props}
      >
        {children}
      </nav>
    </SideNavigationProvider>
  );
}

function SideNavigationHeader({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn(sideNavigationHeaderClassName, className)} {...props} />;
}

function SideNavigationContent({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn(sideNavigationContentClassName, className)} {...props} />;
}

function SideNavigationFooter({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn(sideNavigationFooterClassName, className)} {...props} />;
}

function SideNavigationGroup({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn(sideNavigationGroupClassName, className)} {...props} />;
}

function SideNavigationGroupLabel({ className, ...props }: ComponentProps<"div">) {
  const { collapsed } = useSideNavigation();

  return (
    <div
      aria-hidden={collapsed || undefined}
      className={cn(sideNavigationGroupLabelRecipe({ collapsed }), className)}
      {...props}
    />
  );
}

export interface SideNavigationItemProps extends Omit<ComponentProps<"button">, "prefix"> {
  asChild?: boolean;
  current?: boolean;
  icon?: ReactNode;
}

/**
 * With `asChild` the child element becomes the interactive root and its own
 * children are treated as the label, so a `Link` keeps its anchor semantics.
 */
function SideNavigationItem({
  asChild = false,
  current = false,
  icon,
  className,
  children,
  ...props
}: SideNavigationItemProps) {
  const { collapsed } = useSideNavigation();
  const child = asChild && isValidElement(children) ? (children as ReactElement<{ children?: ReactNode }>) : null;

  const content = (
    <>
      {icon != null && <span className={sideNavigationItemIconClassName}>{icon}</span>}
      <span className={sideNavigationItemLabelRecipe({ collapsed })}>
        {child ? child.props.children : children}
      </span>
    </>
  );

  const rootProps = {
    "aria-current": current ? ("page" as const) : undefined,
    className: cn(sideNavigationItemRecipe({ collapsed }), className),
  };

  if (child) {
    return (
      <Slot {...rootProps} {...props}>
        {cloneElement(child, undefined, content)}
      </Slot>
    );
  }

  return (
    <button {...rootProps} type="button" {...props}>
      {content}
    </button>
  );
}

export const SideNavigation = Object.assign(SideNavigationRoot, {
  Content: SideNavigationContent,
  Footer: SideNavigationFooter,
  Group: SideNavigationGroup,
  GroupLabel: SideNavigationGroupLabel,
  Header: SideNavigationHeader,
  Item: SideNavigationItem,
});
