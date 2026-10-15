import test from "node:test";
import assert from "node:assert/strict";
import { advanceFrame, screenBox, frameKind, damageAt } from "./playback.ts";
import type { Box, Frame } from "../types/reference.ts";
const box: Box = {
  slot: 0,
  role: "attack",
  profile: 1,
  flags: 0,
  shape: 1,
  special: false,
  x1: -4,
  x2: 28,
  y1: 8,
  y2: 44,
  damage: 12,
  reaction: 0,
  category: 0,
};
const frame = {
  hitpause: false,
  boxes: [box],
  opponent: { health: 256 },
} as Frame;
test("seek clamps, looping wraps in both directions and handles empty captures", () => {
  assert.equal(advanceFrame(0, 100, -1), 0);
  assert.equal(advanceFrame(99, 100, 1), 99);
  assert.equal(advanceFrame(99, 100, 1, true), 0);
  assert.equal(advanceFrame(0, 100, -1, true), 99);
  assert.equal(advanceFrame(7, 0, 1, true), 0);
});
test("box transforms preserve extents and reverse reach when facing changes", () => {
  assert.deepEqual(screenBox(box, 100, 200, 0, 2), {
    x: 92,
    y: 112,
    width: 64,
    height: 72,
  });
  assert.deepEqual(screenBox(box, 100, 200, 1, 2), {
    x: 44,
    y: 112,
    width: 64,
    height: 72,
  });
});
test("hitpause remains distinct from advancing active frames and unknown shapes are excluded", () => {
  assert.equal(frameKind(frame), "active");
  assert.equal(frameKind({ ...frame, hitpause: true }), "pause");
  assert.equal(
    frameKind({ ...frame, boxes: [{ ...box, special: true }] }),
    "inactive",
  );
  assert.equal(
    frameKind({ ...frame, boxes: [{ ...box, profile: 0 }] }),
    "inactive",
  );
});
test("damage event is actual HP decrease, never healing or first-frame baseline", () => {
  const frames = [
    frame,
    { ...frame, opponent: { ...frame.opponent, health: 243 } },
    { ...frame, opponent: { ...frame.opponent, health: 256 } },
  ];
  assert.equal(damageAt(frames, 0), 0);
  assert.equal(damageAt(frames, 1), 13);
  assert.equal(damageAt(frames, 2), 0);
});

test("camera X/Y scales affect local box extents exactly once", () => {
  // Native image pixels need a 0.5x world X and 0.75x world Y transform.
  // Displaying the image at 2x gives local scales 1 and 1.5 respectively.
  assert.deepEqual(screenBox(box, 110, 220, 0, 1, 1.5), {
    x: 106,
    y: 154,
    width: 32,
    height: 54,
  });
  assert.deepEqual(screenBox(box, 110, 220, 1, 1, 1.5), {
    x: 82,
    y: 154,
    width: 32,
    height: 54,
  });
});
