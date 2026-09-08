import { AppError } from "@repo/contracts";
import { describe, expect, it, vi } from "vitest";
import { appErrorHandler } from "./errors.js";

describe("appErrorHandler", () => {
  it("maps AppError and validation errors", async () => {
    const reply = {
      status: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
      hasHeader: vi.fn().mockReturnValue(false),
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

  it("maps ZodError to VALIDATION_ERROR", async () => {
    const { ZodError } = await import("zod");
    const reply = {
      status: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
      hasHeader: vi.fn().mockReturnValue(false),
    };

    const zodError = ZodError.create([
      {
        code: "invalid_type",
        expected: "string",
        received: "undefined",
        path: ["email"],
        message: "Required",
      },
    ]);

    await appErrorHandler(zodError as never, {} as never, reply as never);
    expect(reply.status).toHaveBeenCalledWith(422);
    expect(reply.send).toHaveBeenCalledWith(
      expect.objectContaining({
        errorCode: "VALIDATION_ERROR",
        status: 422,
      }),
    );
  });

  it("maps unexpected errors to internal and redacts secrets", async () => {
    const reply = {
      status: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
      hasHeader: vi.fn().mockReturnValue(false),
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

  it("maps rate limit, not found, method not allowed, and bad request", async () => {
    const reply = {
      status: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
      hasHeader: vi.fn().mockReturnValue(false),
    };

    await appErrorHandler(
      Object.assign(new Error("slow down"), { statusCode: 429 }) as never,
      {} as never,
      reply as never,
    );
    expect(reply.send).toHaveBeenCalledWith(
      expect.objectContaining({ errorCode: "RATE_LIMITED", status: 429 }),
    );

    await appErrorHandler(
      Object.assign(new Error("missing"), { code: "FST_ERR_NOT_FOUND", statusCode: 404 }) as never,
      {} as never,
      reply as never,
    );
    expect(reply.send).toHaveBeenCalledWith(
      expect.objectContaining({ errorCode: "NOT_FOUND", status: 404 }),
    );

    await appErrorHandler(
      Object.assign(new Error("nope"), {
        code: "FST_ERR_METHOD_NOT_ALLOWED",
        statusCode: 405,
      }) as never,
      {} as never,
      reply as never,
    );
    expect(reply.send).toHaveBeenCalledWith(
      expect.objectContaining({ errorCode: "METHOD_NOT_ALLOWED", status: 405 }),
    );

    await appErrorHandler(
      Object.assign(new Error("bad json"), {
        code: "FST_ERR_CTP_INVALID_JSON_BODY",
        statusCode: 400,
      }) as never,
      {} as never,
      reply as never,
    );
    expect(reply.send).toHaveBeenCalledWith(
      expect.objectContaining({ errorCode: "BAD_REQUEST", status: 400 }),
    );
  });

  it("does not map arbitrary statusCode from unknown errors to client codes", async () => {
    const reply = {
      status: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
      hasHeader: vi.fn().mockReturnValue(false),
    };
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    await appErrorHandler(
      Object.assign(new Error("spoofed"), { statusCode: 404 }) as never,
      {} as never,
      reply as never,
    );
    expect(reply.send).toHaveBeenCalledWith(
      expect.objectContaining({ errorCode: "INTERNAL_ERROR", status: 500 }),
    );

    errorSpy.mockRestore();
  });
});
