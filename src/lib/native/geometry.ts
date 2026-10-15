import type { Row, Profiles, Role, Rectangle } from './types.ts';

function n(row: Row, key: string, fallback = 0): number { const value = row[key]; return value === undefined || value === "" ? fallback : Number(value); }
function signed8(value: number) { return value >= 128 ? value - 256 : value; }
function signed16(value: number) { return value >= 32768 ? value - 65536 : value; }
function hexBytes(value?: string): Uint8Array {
  if (!value) return new Uint8Array(0);
  if (!/^(?:[0-9a-f]{2})+$/i.test(value)) throw new Error("Invalid native hex field");
  return Uint8Array.from(value.match(/../g)!.map(pair => parseInt(pair, 16)));
}
function packetWord(packet: Uint8Array, offset: number, fallback = 0) { return packet.length >= offset + 2 ? packet[offset] * 256 + packet[offset + 1] : fallback; }

/** Native floor transforms; collision coordinates omit baseY, matching33FA2/32634. */
export function nativeRectangles(row: Row, profiles: Profiles, who: "p1" | "p2" | "object"): { boxes: Rectangle[]; special: number } {
  const object = who === "object", prefix = object ? "" : who + "_";
  // Native SHOT construction registers collision at36F4E. LINK and other
  // cosmetic tasks reuse this packet space for unrelated data.
  if (object && (row.registered_collision !== undefined && n(row, "registered_collision") >= 0
    ? n(row, "registered_collision") !== 1 : ![0x2df76, 0x2e02e].includes(n(row, "function")))) return { boxes: [], special: 0 };
  const packet = hexBytes(row[object ? "actor_packet" : prefix + "actor_packet"]);
  const character = n(row, object ? "character" : prefix + "char", -1);
  const flags = character >= 0 ? profiles.flags_by_character[String(character & 31)] : undefined;
  const facing = n(row, object ? "facing" : prefix + "facing", packet[0x41] || 0);
  const x = signed16(n(row, object ? "x" : prefix + "x"));
  const height = signed16(n(row, object ? "y" : prefix + "y"));
  const sxKey = who === "p2" ? "p2_scale_x_byte" : "scale_x_byte";
  const syKey = who === "p2" ? "p2_scale_y_byte" : "scale_y_byte";
  const oxKey = who === "p2" ? "p2_origin_x_word" : "origin_x_word";
  const oyKey = who === "p2" ? "p2_origin_y_word" : "origin_y_word";
  if (![sxKey, syKey, oxKey, oyKey].every(key => row[key] !== undefined && row[key] !== "")) return { boxes: [], special: 0 };
  const sx = (n(row, sxKey) + 1) / 256, sy = (n(row, syKey) + 1) / 256;
  const ox = signed16(n(row, oxKey)), oy = signed16(n(row, oyKey));
  const transform = (role: Role, local: number[], damage: number, label: string): Rectangle => {
    const xs = [local[0], local[1]].map(value => Math.floor((x + (facing ? -value : value)) * sx) + ox);
    const ys = [local[2], local[3]].map(value => Math.floor((value - height) * sy) + oy - 16);
    return { role, x: Math.min(...xs), y: Math.min(...ys), width: Math.abs(xs[1] - xs[0]), height: Math.abs(ys[1] - ys[0]), damage, label };
  };
  const raw = hexBytes(row[object ? "boxes" : who === "p1" ? "boxes" : "p2_boxes"]);
  const boxes: Rectangle[] = [];
  let special = 0;
  for (let offset = 0; offset + 10 <= Math.min(raw.length, 80); offset += 10) {
    if (!raw[offset]) continue;
    if (object && !raw[offset + 1]) continue;
    const scale = 1 << (raw[offset + 2] & 7);
    const role = flags ? (flags[raw[offset]] & 1 ? "hurt" : "attack") : "unknown";
    //37218 dispatches shapes>=8 through793DE. Index0 is a world floor
    //band from native camera bounds; the other seven handlers return zeros.
    if (raw[offset + 2] >= 8) {
      if ((raw[offset + 2] & 7) !== 0) continue;
      if (row.stage_left === undefined || row.stage_right === undefined) { special++; continue; }
      const xs = [signed16(n(row, "stage_left")), signed16(n(row, "stage_right"))].map(value => Math.floor(value * sx) + ox);
      const ys = [-1, 0].map(value => Math.floor(value * sy) + oy - 16);
      boxes.push({ role, x: Math.min(...xs), y: Math.min(...ys), width: Math.abs(xs[1] - xs[0]), height: Math.abs(ys[1] - ys[0]), damage: raw[offset + 7], label: "Floor" });
      continue;
    }
    boxes.push(transform(role, [signed8(raw[offset + 3]) * scale, signed8(raw[offset + 4]) * scale,
      signed8(raw[offset + 5]) * scale, signed8(raw[offset + 6]) * scale], raw[offset + 7], object ? "OBJ" : who.toUpperCase()));
  }
  const push = hexBytes(row[object ? "push" : prefix + "push"]);
  if (!object && push.length === 12 && push[0]) {
    const scale = 1 << (packetWord(push, 2) & 7);
    boxes.push(transform("push", [4, 6, 8, 10].map(offset => signed16(packetWord(push, offset)) * scale), 0, object ? "OBJ" : who.toUpperCase()));
  }
  return { boxes, special };
}

