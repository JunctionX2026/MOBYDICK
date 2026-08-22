export type SpinnerSize = "large" | "medium" | "small";

export interface SpinnerGeometry {
  bladeHeight: number;
  bladeRadius: number;
  blades: number;
  bladeWidth: number;
  output: number;
}

const geometryBySize: Record<SpinnerSize, SpinnerGeometry> = {
  large: { blades: 10, bladeHeight: 6, bladeRadius: 1, bladeWidth: 2, output: 20 },
  medium: { blades: 8, bladeHeight: 5, bladeRadius: 1, bladeWidth: 2, output: 16 },
  small: { blades: 6, bladeHeight: 4, bladeRadius: 0.75, bladeWidth: 1.5, output: 12 },
};

export function getSpinnerGeometry(size: SpinnerSize): SpinnerGeometry {
  return geometryBySize[size];
}
