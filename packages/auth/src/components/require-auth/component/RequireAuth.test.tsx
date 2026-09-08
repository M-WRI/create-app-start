import { screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  createMockAuthClient,
  renderWithAuth,
  sessionUser,
} from "../../../test/render-with-auth.js";
import { RequireAuth, RequireRole } from "./RequireAuth.js";

describe("RequireAuth", () => {
  it("renders loading while me is pending", async () => {
    const client = createMockAuthClient({
      me: vi.fn().mockReturnValue(new Promise(() => {})),
    });
    await renderWithAuth(
      <RequireAuth loading={<p>Loading session</p>} fallback={<p>Signed out</p>}>
        <p>Protected</p>
      </RequireAuth>,
      { client },
    );

    expect(screen.getByText("Loading session")).toBeTruthy();
    expect(screen.queryByText("Protected")).toBeNull();
  });

  it("renders fallback when there is no user", async () => {
    const client = createMockAuthClient({
      me: vi.fn().mockRejectedValue(new Error("unauthorized")),
    });
    await renderWithAuth(
      <RequireAuth fallback={<p>Signed out</p>}>
        <p>Protected</p>
      </RequireAuth>,
      { client },
    );

    expect(await screen.findByText("Signed out")).toBeTruthy();
    expect(screen.queryByText("Protected")).toBeNull();
  });

  it("renders children when authenticated", async () => {
    const client = createMockAuthClient({
      me: vi.fn().mockResolvedValue({ user: sessionUser }),
    });
    await renderWithAuth(
      <RequireAuth fallback={<p>Signed out</p>}>
        <p>Protected</p>
      </RequireAuth>,
      { client },
    );

    expect(await screen.findByText("Protected")).toBeTruthy();
  });
});

describe("RequireRole", () => {
  it("renders fallback when role is insufficient", async () => {
    const client = createMockAuthClient({
      me: vi.fn().mockResolvedValue({ user: sessionUser }),
    });
    await renderWithAuth(
      <RequireRole roles="admin" fallback={<p>Forbidden</p>}>
        <p>Admin only</p>
      </RequireRole>,
      { client },
    );

    expect(await screen.findByText("Forbidden")).toBeTruthy();
    expect(screen.queryByText("Admin only")).toBeNull();
  });

  it("renders children when role matches", async () => {
    const client = createMockAuthClient({
      me: vi.fn().mockResolvedValue({
        user: { ...sessionUser, role: "admin" as const },
      }),
    });
    await renderWithAuth(
      <RequireRole roles="admin" fallback={<p>Forbidden</p>}>
        <p>Admin only</p>
      </RequireRole>,
      { client },
    );

    await waitFor(() => expect(screen.getByText("Admin only")).toBeTruthy());
  });

  it("renders loading while me is pending", async () => {
    const client = createMockAuthClient({
      me: vi.fn().mockReturnValue(new Promise(() => {})),
    });
    await renderWithAuth(
      <RequireRole roles="user" loading={<p>Checking role</p>} fallback={<p>Forbidden</p>}>
        <p>Allowed</p>
      </RequireRole>,
      { client },
    );

    expect(screen.getByText("Checking role")).toBeTruthy();
  });
});
