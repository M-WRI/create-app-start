import assert from "node:assert/strict";
import test from "node:test";
import { getWorkspaceStatus } from "./index.js";

test("workspace smoke reports ok", () => {
  assert.equal(getWorkspaceStatus(), "ok");
});
