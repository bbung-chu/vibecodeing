import { expect, test } from "@playwright/test";
import { loadSupabaseEnv } from "../scripts/supabase-env";
import { gotoReady, login, uniqueEmail } from "./helpers";

test("security headers are set on pages", async ({ request }) => {
  const res = await request.get("/login");
  const h = res.headers();
  const csp = h["content-security-policy"] ?? "";
  const { url } = loadSupabaseEnv();
  expect(csp).toContain("default-src 'self'");
  expect(csp).toContain("frame-ancestors 'none'");
  expect(csp).toContain("object-src 'none'");
  expect(csp).toContain("base-uri 'self'");
  expect(csp).toContain("form-action 'self'");
  expect(csp).toMatch(new RegExp(`connect-src [^;]*${url.replace(/[.]/g, "\\.")}`));
  expect(h["x-frame-options"]).toBe("DENY");
  expect(h["x-content-type-options"]).toBe("nosniff");
  expect(h["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  expect(h["permissions-policy"]).toBe("camera=(), microphone=(), geolocation=()");
  expect(h["x-powered-by"]).toBeUndefined();
});

test("pages run without CSP violations", async ({ page }) => {
  const violations: string[] = [];
  page.on("console", (m) => /Content Security Policy|Refused to/i.test(m.text()) && violations.push(m.text()));
  await login(page, uniqueEmail("csp"));
  for (const path of ["/", "/timetable", "/materials", "/schedule"]) await gotoReady(page, path);
  expect(violations).toEqual([]);
});
