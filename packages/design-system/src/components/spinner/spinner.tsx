import { forwardRef, type ComponentProps, type CSSProperties } from "react";
import { cn } from "../../cn";
import { spinnerRecipe, type SpinnerRecipeProps } from "../../recipes/spinner";
import { getSpinnerGeometry, type SpinnerSize } from "./spinner-geometry";

export type { SpinnerSize } from "./spinner-geometry";

export interface SpinnerProps extends Omit<ComponentProps<"output">, "size">, SpinnerRecipeProps {
  label?: string;
  size?: SpinnerSize;
}

const DECORATIVE_PHASE_SPAN = 0.75;

export const Spinner = forwardRef<HTMLOutputElement, SpinnerProps>(function Spinner(
  {
    "aria-label": ariaLabel,
    "aria-labelledby": ariaLabelledBy,
    className,
    label = "Loading",
    size = "medium",
    style: customStyle,
    variant,
    ...props
  },
  ref,
) {
  const { bladeRadius, blades, output } = getSpinnerGeometry(size);
  const step = 360 / blades;
  const bladeStyles = Array.from({ length: blades }, (_, index) => {
    const angle = index * step;
    const delayFactor = -((blades - 1 - index) * (DECORATIVE_PHASE_SPAN / blades));

    return { angle, delay: `${delayFactor}s` };
  });

  return (
    <output
      {...props}
      aria-atomic="true"
      aria-label={ariaLabelledBy ? undefined : (ariaLabel ?? label)}
      aria-labelledby={ariaLabelledBy}
      aria-live="polite"
      className={cn(spinnerRecipe({ variant }), className)}
      data-spinner-size={size}
      ref={ref}
      style={{ height: `${output}px`, width: `${output}px`, ...customStyle }}
    >
      {bladeStyles.map(({ angle, delay }) => (
        <span
          aria-hidden="true"
          className="moby-spinner-blade"
          key={`blade-${angle}`}
          style={
            {
              animationDelay: delay,
              borderRadius: `${bladeRadius}px`,
              transform: `rotate(${angle}deg)`,
            } as CSSProperties
          }
        />
      ))}
    </output>
  );
});
