import { type ClassValue, clsx } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/**
 * tailwind-merge only resolves conflicts between values it already knows.
 * Our theme adds radius, shadow and easing names that are absent from the
 * default scale, so without registering them `cn("rounded-surface",
 * "rounded-pill")` keeps both classes and lets stylesheet order decide.
 */
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      ease: ["standard"],
      radius: ["control", "control-small", "pill", "surface"],
      shadow: ["elevation-raised", "elevation-floating", "elevation-overlay"],
    },
  },
});

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
