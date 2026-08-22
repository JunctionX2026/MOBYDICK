"use client";

import { Button, SideNavigation, cn } from "@mobydick/design-system";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useBooleanState } from "react-simplikit";
import {
  CollapseIcon,
  ComposeIcon,
  DiscoverIcon,
  OverviewIcon,
  PlusIcon,
  ServeIcon,
} from "./icons";

const NAVIGATION = [
  { group: "개요", items: [{ href: "/", label: "홈", Icon: OverviewIcon }] },
  {
    group: "파이프",
    items: [
      { href: "/discover", label: "발견", Icon: DiscoverIcon },
      { href: "/compose", label: "조립", Icon: ComposeIcon },
      { href: "/serve", label: "배포", Icon: ServeIcon },
    ],
  },
] as const;

export function AppSidebar() {
  const pathname = usePathname();
  const [collapsed, , , toggleCollapsed] = useBooleanState(false);

  return (
    <SideNavigation aria-label="주 메뉴" collapsed={collapsed}>
      <SideNavigation.Header>
        <Link
          aria-label="MOBYDICK 홈"
          className="text-fg-neutral rounded-control px-1.5 text-base font-bold tracking-tight"
          href="/"
        >
          {collapsed ? "M" : "MOBYDICK"}
        </Link>
      </SideNavigation.Header>

      <SideNavigation.Content>
        <Button asChild className="w-full" iconOnly={collapsed}>
          <Link aria-label="프로젝트 생성" href="/discover">
            <PlusIcon className="size-4 shrink-0" />
            {!collapsed && "프로젝트 생성"}
          </Link>
        </Button>

        {NAVIGATION.map(({ group, items }) => (
          <SideNavigation.Group key={group}>
            <SideNavigation.GroupLabel>{group}</SideNavigation.GroupLabel>
            {items.map(({ href, label, Icon }) => (
              <SideNavigation.Item
                asChild
                current={pathname === href}
                icon={<Icon />}
                key={href}
                title={label}
              >
                <Link href={href}>{label}</Link>
              </SideNavigation.Item>
            ))}
          </SideNavigation.Group>
        ))}
      </SideNavigation.Content>

      <SideNavigation.Footer>
        <SideNavigation.Item
          aria-expanded={!collapsed}
          icon={<CollapseIcon className={cn("transition-transform", collapsed && "rotate-180")} />}
          onClick={toggleCollapsed}
          title={collapsed ? "사이드바 펼치기" : "사이드바 접기"}
        >
          접기
        </SideNavigation.Item>
      </SideNavigation.Footer>
    </SideNavigation>
  );
}
