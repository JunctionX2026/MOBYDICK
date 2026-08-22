export const NODE_WIDTH = 216;
export const NODE_HEIGHT = 84;

/** Node positions snap to this grid, matching the n8n editor. */
export const GRID = 16;

/** Horizontal gap between a node and the next one the palette appends. */
export const NODE_STEP = NODE_WIDTH + GRID * 4;

/** How close a dragged link has to come to an input port before it snaps. */
export const PORT_SNAP = 60;

export const MIN_ZOOM = 0.4;
export const MAX_ZOOM = 2;

export function snapToGrid(value: number) {
  return Math.round(value / GRID) * GRID;
}
