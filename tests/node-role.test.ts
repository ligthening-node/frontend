import { describe, expect, it } from "vitest";

import { nodeRole } from "@/lib/node-role";

describe("nodeRole", () => {
  it("uses NODE_LABEL when set", () => {
    expect(nodeRole({ NODE_LABEL: "Peer node", LN_API_TOKEN: "t" })).toEqual({ label: "Peer node", isPeer: true });
    expect(nodeRole({ NODE_LABEL: "Main node" })).toEqual({ label: "Main node", isPeer: false });
  });

  it("falls back to the API url", () => {
    expect(nodeRole({ LN_API_TOKEN: "t", LN_API_URL: "http://127.0.0.1:3002" })).toEqual({
      label: "Peer node",
      isPeer: true,
    });
    expect(nodeRole({ LN_API_TOKEN: "t" })).toEqual({ label: "Main node", isPeer: false });
  });

  it("shows nothing when no node is configured", () => {
    expect(nodeRole({})).toBeNull();
  });
});
