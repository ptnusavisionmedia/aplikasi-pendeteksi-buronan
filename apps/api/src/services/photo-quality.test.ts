import assert from "node:assert/strict";
import { test } from "node:test";
import { isEnrollmentComplete, validatePhotoQuality } from "./photo-quality";

test("photo without dimensions fails the quality gate", () => {
  const result = validatePhotoQuality({});
  assert.equal(result.valid, false);
  assert.match(result.reason ?? "", /dimensi/i);
});

test("photo below minimum resolution fails the quality gate", () => {
  const result = validatePhotoQuality({ width: 200, height: 200 });
  assert.equal(result.valid, false);
  assert.match(result.reason ?? "", /resolusi/i);
});

test("photo meeting minimum resolution passes", () => {
  const result = validatePhotoQuality({ width: 640, height: 640 });
  assert.equal(result.valid, true);
});

test("single angle on file is not enough for enrollment", () => {
  assert.equal(isEnrollmentComplete([{ angle: "FRONTAL" }]), false);
  assert.equal(isEnrollmentComplete([{ angle: "FRONTAL" }, { angle: "FRONTAL" }]), false);
});

test("two distinct angles complete enrollment", () => {
  assert.equal(isEnrollmentComplete([{ angle: "FRONTAL" }, { angle: "SAMPING_KIRI" }]), true);
});
