import { ProjectPicker } from "./_components/project-picker";

export default function HomePage() {
  return (
    <main className="bg-bg-layer-basement flex min-h-dvh items-start justify-center px-4 py-8 sm:px-8 sm:py-12">
      <div className="w-full max-w-5xl">
        <ProjectPicker />
      </div>
    </main>
  );
}
