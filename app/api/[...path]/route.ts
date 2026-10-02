import type { NextRequest } from "next/server";

// Only these axum routes are reachable from the browser; everything else is a 404 here.
const ALLOWED: ReadonlySet<string> = new Set([
  "node/status",
  "node/sync",
  "wallet/address",
  "wallet/balance",
  "wallet/send",
  "peers",
  "peers/disconnect",
  "channels",
  "channels/close",
  "invoices",
  "payments",
  "events",
  "decode",
]);

const API_URL: string = process.env.LN_API_URL ?? "http://127.0.0.1:3001";

function errorResponse(status: number, code: string, message: string): Response {
  return Response.json({ error: { code, message } }, { status });
}

async function proxy(request: NextRequest, ctx: RouteContext<"/api/[...path]">): Promise<Response> {
  const { path } = await ctx.params;
  const target = path.join("/");
  if (!ALLOWED.has(target)) {
    return errorResponse(404, "not_found", "unknown API route");
  }

  const token = process.env.LN_API_TOKEN;
  if (token === undefined) {
    return errorResponse(500, "not_configured", "LN_API_TOKEN is not set on the Next.js server");
  }

  const hasBody = request.method !== "GET" && request.method !== "HEAD";
  try {
    const upstream = await fetch(`${API_URL}/${target}`, {
      method: request.method,
      headers: {
        authorization: `Bearer ${token}`,
        ...(hasBody ? { "content-type": "application/json" } : {}),
      },
      body: hasBody ? await request.text() : undefined,
      cache: "no-store",
      // Closes the upstream event stream when the browser tab goes away.
      signal: request.signal,
    });
    const headers: Record<string, string> = {
      "content-type": upstream.headers.get("content-type") ?? "application/json",
    };
    if (target === "events") {
      headers["cache-control"] = "no-cache, no-transform";
    }
    return new Response(upstream.body, { status: upstream.status, headers });
  } catch {
    return errorResponse(502, "node_unreachable", "the node API is not reachable");
  }
}

export const GET = proxy;
export const POST = proxy;
