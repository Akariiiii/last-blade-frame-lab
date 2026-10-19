import { nativeOrigin, grabRangeSpan, type NativeRange } from '../../lib/native/range.ts';
import type { Row } from '../../lib/native/types.ts';

/** Canvas coordinates are the320×224 native framebuffer, before CSS scaling. */
export function drawRange(context: CanvasRenderingContext2D, row: Row, range: NativeRange) {
  const p = nativeOrigin(row, 'p1'), q = nativeOrigin(row, 'p2');
  if (!p || !q || range.positionGap === null) return;
  context.save();
  const y = Math.min(216, Math.max(16, Math.max(p.ground, q.ground) + 5));
  const span = grabRangeSpan(row, range);
  if (span) {
    const lo = Math.min(span.start, span.end), hi = Math.max(span.start, span.end);
    context.fillStyle = '#e5bd6e24'; context.strokeStyle = '#e5bd6e';
    context.lineWidth = .75; context.setLineDash([3, 2]);
    context.fillRect(lo, y - 11, hi - lo, 8); context.strokeRect(lo, y - 11, hi - lo, 8);
    context.setLineDash([]);
    context.beginPath();context.moveTo(span.start, y - 13);context.lineTo(span.start, y - 1);
    context.moveTo(span.end, y - 13);context.lineTo(span.end, y - 1);context.stroke();
  }
  context.strokeStyle = '#f5eee0'; context.lineWidth = .75;
  context.beginPath();
  context.moveTo(p.x, y); context.lineTo(q.x, y);
  for (const point of [p, q]) {
    context.moveTo(point.x, y - 3); context.lineTo(point.x, y + 3);
    context.moveTo(point.x, Math.min(point.y, y)); context.lineTo(point.x, y);
  }
  context.stroke();
  // Text lives in RangeLabel's DOM overlay so pixel-art scaling cannot rasterize it.
  context.restore();
}
