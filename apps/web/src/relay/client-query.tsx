"use client";

import { Suspense, type ReactNode } from "react";
import { useIsClient } from "react-simplikit";

export interface ClientQueryProps {
  children: ReactNode;
  fallback: ReactNode;
}

/**
 * Relay talks to `/api/graphql` over a relative URL, which only resolves in the
 * browser. Queries therefore start after hydration and the shell prerenders.
 */
export function ClientQuery({ children, fallback }: ClientQueryProps) {
  const isClient = useIsClient();

  return <Suspense fallback={fallback}>{isClient ? children : fallback}</Suspense>;
}
