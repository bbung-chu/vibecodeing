import { afterEach, describe, expect, it, vi } from "vitest";
import * as route from "@/app/auth/test-login/route";

afterEach(() => {
  vi.unstubAllEnvs();
});

const url = "http://localhost:3000/auth/test-login";
const post = () =>
  new Request(url, { method: "POST", body: JSON.stringify({ email: "a@b.com", password: "x" }) });

describe("/auth/test-login gating", () => {
  it("returns 404 when E2E is unset", async () => {
    vi.stubEnv("E2E", "");
    expect((await route.POST(post())).status).toBe(404);
  });

  it("returns 404 when E2E=1 but NODE_ENV is production", async () => {
    vi.stubEnv("E2E", "1");
    vi.stubEnv("NODE_ENV", "production");
    expect((await route.POST(post())).status).toBe(404);
  });

  it("exposes no GET handler (password never in a URL)", () => {
    expect("GET" in route).toBe(false);
  });
});
