import Image from "next/image";
import { cn } from "@mobydick/design-system";

export function CoverImage({ className }: { className?: string }) {
  return (
    <Image
      alt=""
      className={cn("pointer-events-none h-full w-full object-cover select-none", className)}
      draggable={false}
      height={640}
      priority
      src="/cover.svg"
      width={1200}
    />
  );
}
