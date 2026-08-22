import type { ProjectPhase } from "@mobydick/domain";
import { match } from "ts-pattern";

export const PROJECT_PHASES = ["discover", "compose", "serve"] as const;

export function isProjectPhase(value: string): value is ProjectPhase {
  return (PROJECT_PHASES as readonly string[]).includes(value);
}

export function describePhase(phase: ProjectPhase) {
  return match(phase)
    .with("discover", () => ({ label: "발견", tone: "informative" as const }))
    .with("compose", () => ({ label: "조립", tone: "brand" as const }))
    .with("serve", () => ({ label: "배포", tone: "positive" as const }))
    .exhaustive();
}
