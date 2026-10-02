import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ChannelRow } from "@/components/node/channels";
import { parseKnownNodes } from "@/lib/node-labels";
import type { ChannelView } from "@/lib/types/ChannelView";

const PEER_ID = "03c31cb9dcbf0555125d3ab97a6015e25264cfff9c5b2c0558dc01d8446e565f2e";

const CHANNEL: ChannelView = {
  channel_id: "aa".repeat(32),
  user_channel_id: "42",
  counterparty_node_id: PEER_ID,
  funding_txo: null,
  short_channel_id: null,
  capacity_sat: "1000000",
  outbound_msat: "750000000",
  inbound_msat: "250000000",
  max_send_msat: "100000000",
  is_outbound: true,
  is_channel_ready: true,
  is_usable: true,
  confirmations: 6,
  confirmations_required: 6,
  our_balance_sat: "900000",
  our_reserve_sat: "10000",
  their_reserve_sat: "10000",
};

describe("parseKnownNodes", () => {
  it("parses label=url pairs and skips broken ones", () => {
    expect(parseKnownNodes("Main node=http://a:1, Peer node=http://b:2,junk,=x,y=")).toEqual([
      { label: "Main node", url: "http://a:1" },
      { label: "Peer node", url: "http://b:2" },
    ]);
  });

  it("defaults to the local main node and peer", () => {
    expect(parseKnownNodes(undefined).map((n) => n.label)).toEqual(["Main node", "Peer node"]);
  });
});

describe("node names on a channel", () => {
  it("labels a known counterparty", () => {
    render(<ChannelRow channel={CHANNEL} labels={{ [PEER_ID]: "Peer node" }} onClosed={(): void => {}} />);
    expect(screen.getByTestId("node-name")).toHaveTextContent("Peer node");
  });

  it("shows no label for an unknown counterparty", () => {
    render(<ChannelRow channel={CHANNEL} labels={{}} onClosed={(): void => {}} />);
    expect(screen.queryByTestId("node-name")).toBeNull();
  });
});
