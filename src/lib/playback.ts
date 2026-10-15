import type { Box, Frame } from "../types/reference.ts";

export function advanceFrame(
  current: number,
  count: number,
  delta: number,
  loop = false,
): number {
  if (count < 1) return 0;
  const next = current + delta;
  return loop
    ? ((next % count) + count) % count
    : Math.max(0, Math.min(count - 1, next));
}

/** Coordinates stay local to an actor. Screen y increases downward. */
export function screenBox(
  box: Box,
  originX: number,
  originY: number,
  facing: number,
  scale: number,
  verticalScale = scale,
) {
  const xs = [box.x1, box.x2].map((x) => originX + (facing ? -x : x) * scale);
  const ys = [box.y1, box.y2].map((y) => originY - y * verticalScale);
  return {
    x: Math.min(...xs),
    y: Math.min(...ys),
    width: Math.abs(xs[1] - xs[0]),
    height: Math.abs(ys[1] - ys[0]),
  };
}

export function frameKind(frame: Frame): "pause" | "active" | "inactive" {
  if (frame.hitpause) return "pause";
  return frame.boxes.some(
    (box) => box.role === "attack" && box.profile !== 0 && !box.special,
  )
    ? "active"
    : "inactive";
}

export function damageAt(frames: Frame[], index: number): number {
  return index > 0
    ? Math.max(
        0,
        frames[index - 1].opponent.health - frames[index].opponent.health,
      )
    : 0;
}

export function fmt(value?: number): string {
  return value === undefined ? "—" : String(value);
}
export function signed(value?: number): string {
  return value === undefined ? "—" : `${value > 0 ? "+" : ""}${value}`;
}
export function hex(value: number, length = 3): string {
  return `0x${value.toString(16).toUpperCase().padStart(length, "0")}`;
}
