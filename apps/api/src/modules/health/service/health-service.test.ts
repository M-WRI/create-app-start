import { describe, expect, it } from "vitest";
import { getHealthStatus } from "./health-service.js";

describe("getHealthStatus", () => {
  it("returns ok", () => {
    expect(getHealthStatus()).toEqual({ status: "ok" });
  });
});
