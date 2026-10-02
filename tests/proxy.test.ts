import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GET, POST } from "@/app/api/[...path]/route";

type ProxyArgs = Parameters<typeof GET>;

function call(handler: typeof GET, path: string[], method: string = "GET"): Promise<Response> {
  const request = new NextRequest(`http://localhost/api/${path.join("/")}`, { method, body: method === "POST" ? "{}" : undefined });
  return handler(request as ProxyArgs[0], { params: Promise.resolve({ path }) } as ProxyArgs[1]);
}

describe("api proxy", () => {
  beforeEach((): void => {
    vi.stubEnv("LN_API_TOKEN", "secret-token-0123456789");
  });

  afterEach((): void => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("adds the bearer token on the server", async () => {
    const fetchMock = vi.fn(async (): Promise<Response> => Response.json({ ok: true }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await call(GET, ["node", "status"]);

    expect(response.status).toBe(200);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("http://127.0.0.1:3001/node/status");
    expect((init.headers as Record<string, string>).authorization).toBe("Bearer secret-token-0123456789");
  });

  it("rejects routes that are not on the allow list", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await call(GET, ["health"]);

    expect(response.status).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("reports an unreachable node", async () => {
    vi.stubGlobal("fetch", vi.fn(async (): Promise<Response> => Promise.reject(new Error("refused"))));

    const response = await call(POST, ["wallet", "address"], "POST");

    expect(response.status).toBe(502);
    expect(((await response.json()) as { error: { code: string } }).error.code).toBe("node_unreachable");
  });

  it("fails clearly when the token is not configured", async () => {
    vi.stubEnv("LN_API_TOKEN", undefined as unknown as string);
    delete process.env.LN_API_TOKEN;

    const response = await call(GET, ["node", "status"]);

    expect(response.status).toBe(500);
  });

  it("streams events with no-cache and passes the abort signal", async () => {
    const fetchMock = vi.fn(
      async (): Promise<Response> => new Response("data: {}\n\n", { headers: { "content-type": "text/event-stream" } }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await call(GET, ["events"]);

    expect(response.headers.get("content-type")).toBe("text/event-stream");
    expect(response.headers.get("cache-control")).toBe("no-cache, no-transform");
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(init.signal).toBeDefined();
  });

  it("allows the channel and payment routes", async () => {
    vi.stubGlobal("fetch", vi.fn(async (): Promise<Response> => Response.json({ ok: true })));
    for (const path of [["channels", "close"], ["payments"], ["invoices"], ["wallet", "send"], ["peers"]]) {
      expect((await call(POST, path, "POST")).status).toBe(200);
    }
  });
});
