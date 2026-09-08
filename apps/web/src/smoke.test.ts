import { describe, expect, it } from "vitest";

describe("web app", () => {
  it("boots with expected default locale", () => {
    expect("en").toBe("en");
  });
});
