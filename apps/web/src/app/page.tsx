import { Button } from "@mobydick/design-system";
import { ExternalLinkIcon, MobydickMarkIcon } from "@mobydick/icon";
import Link from "next/link";
import { CoverImage } from "./_components/cover-image";
import { ProjectPicker } from "./_components/project-picker";
import { RollingWord } from "./_components/rolling-word";

const HERO_WORDS = ["작업실", "질문", "데이터셋", "파이프라인"] as const;

export default function HomePage() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col px-6">
      <header className="flex h-16 shrink-0 items-center justify-between gap-4">
        <Link
          aria-label="MOBYDICK 홈"
          className="text-fg-neutral flex items-center gap-2 text-sm font-bold tracking-tight"
          href="/"
        >
          <MobydickMarkIcon size={20} />
          MOBYDICK
        </Link>
        <Button asChild size="small" variant="ghost">
          <a
            href="https://github.com/JunctionX2026/MOBYDICK/tree/main/specs"
            rel="noreferrer"
            target="_blank"
          >
            스펙 보기
            <ExternalLinkIcon />
          </a>
        </Button>
      </header>

      <main className="flex flex-col gap-12 pt-8 pb-24">
        <section className="flex flex-col gap-6">
          <h1 className="text-fg-neutral text-4xl leading-tight font-bold tracking-tight sm:text-5xl">
            당신의 다음 <RollingWord words={HERO_WORDS} />
            <br />
            어디인가요?
          </h1>
          <p className="text-fg-neutral-muted max-w-xl text-base">
            흩어진 공공데이터를 찾아서, 붙여서, 쓸 수 있는 형태로 내보내요. 질문 하나로 작업실을
            열고 발견 · 조립 · 배포를 한자리에서 이어가요.
          </p>
        </section>

        <div className="border-stroke-neutral-subtle aspect-[1200/640] w-full overflow-hidden rounded-surface border">
          <CoverImage />
        </div>

        <ProjectPicker />
      </main>
    </div>
  );
}
