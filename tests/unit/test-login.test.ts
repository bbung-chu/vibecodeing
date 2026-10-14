import { afterEach, describe, expect, it, vi } from "vitest";
import { GET, POST } from "@/app/auth/test-login/route";

afterEach(() => {
  vi.unstubAllEnvs();
});

const url = "http://localhost:3000/auth/test-login?email=a@b.com&password=x";

describe("/auth/test-login gating", () => {
  it("returns 404 when E2E is unset", async () => {
    vi.stubEnv("E2E", "");
    const res = await GET(new Request(url));
    expect(res.status).toBe(404);
  });

  it("returns 404 for POST when E2E is unset", async () => {
    vi.stubEnv("E2E", "");
    const res = await POST(
      new Request(url, { method: "POST", body: JSON.stringify({ email: "a@b.com", password: "x" }) }),
    );
    expect(res.status).toBe(404);
  });

  it("returns 404 when E2E=1 but NODE_ENV is production", async () => {
    vi.stubEnv("E2E", "1");
    vi.stubEnv("NODE_ENV", "production");
    const res = await GET(new Request(url));
    expect(res.status).toBe(404);
  });
});
