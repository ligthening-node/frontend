import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiError, disconnectPeer } from "@/lib/api";

const PEER_ID = "03c31cb9dcbf0555125d3ab97a6015e25264cfff9c5b2c0558dc01d8446e565f2e";

afterEach((): void => {
  vi.unstubAllGlobals();
});

describe("disconnectPeer", () => {
  it("posts the node id to the disconnect route", async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ ok: true }));
    vi.stubGlobal("fetch", fetchMock);
    await disconnectPeer(PEER_ID);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/peers/disconnect");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({ node_id: PEER_ID });
  });

  it("surfaces the node's error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(Response.json({ error: { code: "node_error", message: "nope" } }, { status: 500 })),
    );
    await expect(disconnectPeer(PEER_ID)).rejects.toBeInstanceOf(ApiError);
  });
});
