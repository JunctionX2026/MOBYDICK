"use client";

import { Slot } from "@radix-ui/react-slot";
import type { ComponentProps, ReactNode } from "react";
import { buildContext, useControlledState } from "react-simplikit";
import { cn } from "../../cn";
import {
  sideNavigationContentClassName,
  sideNavigationFooterClassName,
  sideNavigationGroupClassName,
  sideNavigationGroupLabelClassName,
  sideNavigationHeaderClassName,
  sideNavigationInsetClassName,
  sideNavigationItemClassName,
  sideNavigationItemLabelClassName,
  sideNavigationItemPrefixIconClassName,
  sideNavigationItemSuffixClassName,
  sideNavigationRootClassName,
  sideNavigationTriggerClassName,
} from "../../recipes/side-navigation";

const [NavigationProvider, useNavigation] = buildContext<{
  collapsed: boolean;
  setCollapsed: (collapsed: boolean) => void;
}>("SideNavigation", undefined);

export interface SideNavigationProviderProps {
  children: ReactNode;
  collapsed?: boolean;
  defaultCollapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
}

function Provider({
  children,
  collapsed: collapsedProp,
  defaultCollapsed = false,
  onCollapsedChange,
}: SideNavigationProviderProps) {
  const [collapsed, setCollapsed] = useControlledState({
    value: collapsedProp,
    defaultValue: defaultCollapsed,
    onChange: onCollapsedChange,
  });

  return (
    <NavigationProvider collapsed={collapsed} setCollapsed={setCollapsed}>
      {children}
    </NavigationProvider>
  );
}

function Root({ className, ...props }: ComponentProps<"nav">) {
  const { collapsed } = useNavigation();

  return (
    <nav
      className={cn(
        sideNavigationRootClassName,
        collapsed ? "w-side-navigation-collapsed" : "w-side-navigation",
        className,
      )}
      data-side-navigation-state={collapsed ? "collapsed" : "expanded"}
      {...props}
    />
  );
}

function Header({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn(sideNavigationHeaderClassName, className)} {...props} />;
}

function Trigger({ className, onClick, ...props }: ComponentProps<"button">) {
  const { collapsed, setCollapsed } = useNavigation();

  return (
    <button
      aria-expanded={!collapsed}
      className={cn(sideNavigationTriggerClassName, className)}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) {
          setCollapsed(!collapsed);
        }
      }}
      type="button"
      {...props}
    />
  );
}

function Content({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn(sideNavigationContentClassName, className)} {...props} />;
}

function Footer({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn(sideNavigationFooterClassName, className)} {...props} />;
}

function Group({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn(sideNavigationGroupClassName, className)} {...props} />;
}

function GroupLabel({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn(sideNavigationGroupLabelClassName, className)} {...props} />;
}

export interface SideNavigationItemProps extends ComponentProps<"button"> {
  asChild?: boolean;
  current?: boolean;
}

/**
 * With `asChild` the child element becomes the interactive root, so a `Link`
 * keeps its anchor semantics while the item still owns the state attributes
 * that its icon and label slots style against.
 */
function Item({
  asChild = false,
  className,
  current = false,
  disabled = false,
  ...props
}: SideNavigationItemProps) {
  const Component = asChild ? Slot : "button";

  return (
    <Component
      aria-current={current ? "page" : undefined}
      aria-disabled={asChild && disabled ? true : undefined}
      className={cn(sideNavigationItemClassName, className)}
      data-current={current ? "" : undefined}
      data-disabled={disabled ? "" : undefined}
      disabled={asChild ? undefined : disabled}
      type={asChild ? undefined : "button"}
      {...props}
    />
  );
}

export interface SideNavigationItemIconProps extends Omit<ComponentProps<"span">, "children"> {
  svg: ReactNode;
}

function ItemPrefixIcon({ className, svg, ...props }: SideNavigationItemIconProps) {
  return (
    <span
      aria-hidden="true"
      className={cn(sideNavigationItemPrefixIconClassName, className)}
      {...props}
    >
      {svg}
    </span>
  );
}

function ItemLabel({ className, ...props }: ComponentProps<"span">) {
  return <span className={cn(sideNavigationItemLabelClassName, className)} {...props} />;
}

function ItemSuffix({ className, ...props }: ComponentProps<"span">) {
  return <span className={cn(sideNavigationItemSuffixClassName, className)} {...props} />;
}

function Inset({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn(sideNavigationInsetClassName, className)} {...props} />;
}

export const SideNavigation = {
  Content,
  Footer,
  Group,
  GroupLabel,
  Header,
  Inset,
  Item,
  ItemLabel,
  ItemPrefixIcon,
  ItemSuffix,
  Provider,
  Root,
  Trigger,
};

export { useNavigation as useSideNavigation };
