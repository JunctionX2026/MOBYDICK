import { Badge, Button, Callout, Card } from "@mobydick/design-system";
import { PipelineStage } from "./_components/pipeline-stage";

export default function HomePage() {
  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-10 px-6 py-16">
      <header className="flex flex-col gap-3">
        <Badge emphasis="weak" tone="brand">
          JunctionX Korea 2026
        </Badge>
        <h1 className="text-fg-neutral text-3xl font-bold tracking-tight">MOBYDICK</h1>
        <p className="text-fg-neutral-muted max-w-2xl text-base">
          흩어진 공공데이터를 찾아서, 붙여서, 쓸 수 있는 형태로 내보내요. Discover → Compose →
          Serve.
        </p>
        <div className="flex gap-2 pt-2">
          <Button>시작하기</Button>
          <Button variant="outline">스펙 보기</Button>
        </div>
      </header>

      <section className="flex flex-col gap-4">
        <h2 className="text-fg-neutral text-lg font-semibold">파이프</h2>
        <div className="flex flex-col gap-3 sm:flex-row">
          <PipelineStage handoff="제안" id="discover" title="그래프 지식 베이스" />
          <PipelineStage handoff="워크플로" id="compose" title="워크플로 캔버스" />
          <PipelineStage handoff="API · MCP" id="serve" title="배포" />
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-fg-neutral text-lg font-semibold">정지 신호</h2>
        <p className="text-fg-neutral-muted text-sm">
          공공데이터 파이프라인의 실패는 조용히 일어나요. 감지한 항목은 그 노드에서 멈추고 이유를
          보여줘요.
        </p>
        <div className="flex flex-col gap-3">
          <Callout tone="critical">
            <Callout.Content>
              <Callout.Title>조인 결과가 0행이에요</Callout.Title>
              <Callout.Description>
                시군구 코드가 겹치는 행이 없어요. 기준 연도를 확인해요.
              </Callout.Description>
            </Callout.Content>
          </Callout>
          <Callout tone="warning">
            <Callout.Content>
              <Callout.Title>지역 매칭률이 68%예요</Callout.Title>
              <Callout.Description>
                23개 시군 중 7개가 매칭되지 않았어요. 제외된 행과 사유를 확인해요.
              </Callout.Description>
            </Callout.Content>
          </Callout>
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-fg-neutral text-lg font-semibold">노드 카드</h2>
        <Card className="max-w-sm">
          <Card.Header>
            <Card.Title>경상북도 생활폐기물 배출량</Card.Title>
            <Card.Description>data.go.kr · 2024</Card.Description>
          </Card.Header>
          <Card.Body className="flex flex-wrap gap-1.5">
            <Badge size="small">행 152 → 19</Badge>
            <Badge size="small">컬럼 7</Badge>
            <Badge size="small">결측 4%</Badge>
            <Badge size="small" tone="warning">
              매칭 68%
            </Badge>
          </Card.Body>
        </Card>
      </section>
    </main>
  );
}
