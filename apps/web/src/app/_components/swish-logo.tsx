import { cn } from "@mobydick/design-system";

export function SwishLogo({ className }: { className?: string }) {
  return (
    <picture className="inline-flex shrink-0">
      <source media="(prefers-color-scheme: dark)" srcSet="/brand/swish-logo-horizontal-inverse.svg" />
      <img
        alt="Swish"
        className={cn("block h-8 w-auto", className)}
        decoding="async"
        height={36}
        src="/brand/swish-logo-horizontal.svg"
        width={162}
      />
    </picture>
  );
}

export function SwishSymbol({ className, size = 20 }: { className?: string; size?: number }) {
  return (
    <picture className="inline-flex shrink-0">
      <source media="(prefers-color-scheme: dark)" srcSet="/brand/swish-symbol-white.svg" />
      <img
        alt=""
        className={cn("block", className)}
        decoding="async"
        height={size}
        src="/brand/swish-symbol.svg"
        width={size}
      />
    </picture>
  );
}
