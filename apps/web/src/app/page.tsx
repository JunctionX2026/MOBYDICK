import { ProjectPicker } from "./_components/project-picker";

export default function HomePage() {
  return (
    <main className="flex min-h-dvh items-center justify-center px-6 py-16">
      <div className="w-full max-w-5xl">
        <ProjectPicker />
      </div>
    </main>
  );
}
