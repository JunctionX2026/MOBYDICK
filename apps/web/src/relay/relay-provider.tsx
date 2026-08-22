"use client";

import type { ReactNode } from "react";
import { RelayEnvironmentProvider } from "react-relay";
import { relayEnvironment } from "./environment";

export function RelayProvider({ children }: { children: ReactNode }) {
  return (
    <RelayEnvironmentProvider environment={relayEnvironment()}>{children}</RelayEnvironmentProvider>
  );
}
