import assert from "node:assert/strict";
import { test } from "node:test";
import { computeCameraAccuracy } from "./camera-accuracy";

test("camera with zero reviewed matches is not flagged", () => {
  const result = computeCameraAccuracy({ confirmedCount: 0, rejectedCount: 0 });
  assert.equal(result.totalReviewed, 0);
  assert.equal(result.falsePositiveRate, 0);
  assert.equal(result.flagged, false);
});

test("high false-positive rate below the minimum sample size is not flagged yet (too noisy)", () => {
  const result = computeCameraAccuracy({ confirmedCount: 0, rejectedCount: 2 });
  assert.equal(result.falsePositiveRate, 1);
  assert.equal(result.flagged, false);
});

test("high false-positive rate with enough samples is flagged", () => {
  const result = computeCameraAccuracy({ confirmedCount: 2, rejectedCount: 4 });
  assert.equal(result.totalReviewed, 6);
  assert.equal(result.falsePositiveRate, 4 / 6);
  assert.equal(result.flagged, true);
});

test("low false-positive rate with enough samples is not flagged", () => {
  const result = computeCameraAccuracy({ confirmedCount: 19, rejectedCount: 1 });
  assert.equal(result.flagged, false);
});
