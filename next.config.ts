import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

/** The Supabase origin (HTTP and its websocket twin), read from the public env var at build/start. */
function supabaseSources(): { http: string[]; ws: string[] } {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!raw) return { http: [], ws: [] };
  const url = new URL(raw);
  return { http: [url.origin], ws: [`${url.protocol === "https:" ? "wss:" : "ws:"}//${url.host}`] };
}

function contentSecurityPolicy(): string {
  const supabase = supabaseSources();
  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    // Next injects inline bootstrap scripts; nonces would force every page dynamic.
    // 'unsafe-eval' is only for the dev server (React refresh).
    "script-src": ["'self'", "'unsafe-inline'", ...(isDev ? ["'unsafe-eval'"] : [])],
    "style-src": ["'self'", "'unsafe-inline'"],
    "img-src": ["'self'", "data:", "blob:", ...supabase.http],
    "connect-src": ["'self'", ...supabase.http, ...supabase.ws],
    "frame-ancestors": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
    "object-src": ["'none'"],
  };
  return Object.entries(directives)
    .map(([name, values]) => `${name} ${values.join(" ")}`)
    .join("; ");
}

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: contentSecurityPolicy() },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
