import assert from "node:assert/strict";
import { test } from "node:test";
import { assessLiveness } from "./liveness";

test("no signal at all defaults to live (backward compatible with engine not sending it yet)", () => {
  assert.equal(assessLiveness({}), true);
});

test("engine-reported isLive verdict is trusted directly", () => {
  assert.equal(assessLiveness({ isLive: false }), false);
  assert.equal(assessLiveness({ isLive: true }), true);
});

test("explicit recapture flag always fails, even if isLive is true", () => {
  assert.equal(assessLiveness({ isLive: true, isRecapture: true }), false);
});

test("low texture score below threshold is treated as spoofed", () => {
  assert.equal(assessLiveness({ textureScore: 0.1 }), false);
});

test("texture score at or above threshold passes", () => {
  assert.equal(assessLiveness({ textureScore: 0.4 }), true);
  assert.equal(assessLiveness({ textureScore: 0.9 }), true);
});
