import { Badge, Card, cn } from "@mobydick/design-system";
import Link from "next/link";
import { match } from "ts-pattern";

export type StageId = "discover" | "compose" | "serve";

export interface PipelineStageProps {
  id: StageId;
  title: string;
  handoff: string;
  className?: string;
}

export function PipelineStage({ className, handoff, id, title }: PipelineStageProps) {
  const { label, step, tone } = match(id)
    .with("discover", () => ({ label: "찾는다", step: "①", tone: "informative" as const }))
    .with("compose", () => ({ label: "붙인다", step: "②", tone: "brand" as const }))
    .with("serve", () => ({ label: "내보낸다", step: "③", tone: "positive" as const }))
    .exhaustive();

  return (
    <Link
      className={cn(
        "rounded-surface flex-1",
        "focus-visible:outline-stroke-focus-ring focus-visible:outline-2 focus-visible:outline-offset-2",
        className,
      )}
      href={`/${id}`}
    >
      <Card className="hover:border-stroke-neutral h-full transition-colors">
        <Card.Header>
          <div className="flex items-center gap-2">
            <span className="text-fg-neutral-subtle text-xs font-semibold">{step}</span>
            <Card.Title>{title}</Card.Title>
          </div>
          <Card.Description>{label}</Card.Description>
        </Card.Header>
        <Card.Body className="flex items-center gap-2">
          <span className="text-fg-neutral-subtle text-xs">다음으로</span>
          <Badge tone={tone}>{handoff}</Badge>
        </Card.Body>
      </Card>
    </Link>
  );
}
