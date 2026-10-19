import { nativeOrigin, type NativeRange } from '../../lib/native/range.ts';
import type { Row } from '../../lib/native/types.ts';

/** Browser text stays at display resolution while the game canvas remains pixelated. */
export default function RangeLabel({ row, range }: { row: Row; range: NativeRange }) {
  const source = nativeOrigin(row, 'p1'), target = nativeOrigin(row, 'p2');
  if (!source || !target || range.positionGap === null) return null;
  const y = Math.min(216, Math.max(16, Math.max(source.ground, target.ground) + 5));
  return <div className="range-label" style={{ top: `${(y - 14) / 224 * 100}%` }} aria-label="Distance on clip">
    <span>Gap <b>{range.positionGap} u</b></span>
    {range.grab && <span>Reach <b>{range.grab.positionRadius} u</b> <small>from P1</small></span>}
  </div>;
}
