import { AppError } from "@repo/contracts";
import { describe, expect, it, vi } from "vitest";
import { appErrorHandler } from "./errors.js";

describe("appErrorHandler", () => {
  it("maps AppError and validation errors", async () => {
    const reply = {
      status: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
    };

    await appErrorHandler(
      new AppError({
        status: 401,
        errorCode: "AUTH_UNAUTHORIZED",
        errorMessage: "nope",
      }) as never,
      {} as never,
      reply as never,
    );
    expect(reply.status).toHaveBeenCalledWith(401);

    await appErrorHandler(
      Object.assign(new Error("bad"), { validation: [] }) as never,
      {} as never,
      reply as never,
    );
    expect(reply.status).toHaveBeenCalledWith(422);
  });

  it("maps unexpected errors to internal and redacts secrets", async () => {
    const reply = {
      status: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
    };
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    await appErrorHandler(
      new Error("leaked password token cookie authorization") as never,
      {} as never,
      reply as never,
    );
    expect(reply.status).toHaveBeenCalledWith(500);
    expect(errorSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining("[redacted]"),
      }),
    );

    await appErrorHandler("plain-string" as never, {} as never, reply as never);
    expect(errorSpy).toHaveBeenCalledWith("Unknown error");

    errorSpy.mockRestore();
  });
});
