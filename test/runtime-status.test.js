import test from "node:test";
import assert from "node:assert/strict";
import { getRuntimeStatus } from "../lib/runtime-status.js";

test("runtime status reflects configured keys", () => {
  assert.equal(getRuntimeStatus({ DART_API_KEY: "dart", KRX_API_KEY: "krx" }).mode, "live");
  assert.equal(getRuntimeStatus({ DART_API_KEY: "dart" }).mode, "partial");
  assert.equal(getRuntimeStatus({}).mode, "offline");
});
