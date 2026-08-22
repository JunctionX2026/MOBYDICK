import { Badge, Card, Skeleton } from "@mobydick/design-system";

export interface StagePlaceholderProps {
  handoff: string;
  stage: string;
  summary: string;
  title: string;
}

export function StagePlaceholder({ handoff, stage, summary, title }: StagePlaceholderProps) {
  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-8 px-6 py-12">
      <header className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <Badge emphasis="weak" tone="brand">
            {stage}
          </Badge>
          <Badge size="small">다음 단계로 {handoff}</Badge>
        </div>
        <h1 className="text-fg-neutral text-2xl font-bold tracking-tight">{title}</h1>
        <p className="text-fg-neutral-muted max-w-2xl text-sm">{summary}</p>
      </header>

      <Card>
        <Card.Header>
          <Card.Title>아직 만들지 않았어요</Card.Title>
          <Card.Description>스펙을 확정한 뒤에 이 자리를 채워요.</Card.Description>
        </Card.Header>
        <Card.Body className="flex flex-col gap-3">
          <Skeleton className="h-8 w-2/5" />
          <Skeleton className="h-32 w-full" radius="surface" />
          <div className="flex gap-3">
            <Skeleton className="h-20 flex-1" radius="surface" />
            <Skeleton className="h-20 flex-1" radius="surface" />
            <Skeleton className="h-20 flex-1" radius="surface" />
          </div>
        </Card.Body>
      </Card>
    </main>
  );
}
