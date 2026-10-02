"use client";

import { WaypointsIcon } from "lucide-react";
import { useState } from "react";
import type { FormEvent, ReactElement } from "react";

import { ChannelAllowance, leftToMove } from "@/components/node/channel-allowance";
import { ApiErrorNotice } from "@/components/node/unreachable";
import { InfoTip } from "@/components/decoder/info-tip";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldError } from "@/components/node/field-error";
import { closeChannel, connectPeer, disconnectPeer, getBalances, getChannels, getNodeLabels, getPeers, openChannel } from "@/lib/api";
import { formatMsat, formatSat, shortHex } from "@/lib/format";
import type { ChannelView } from "@/lib/types/ChannelView";
import type { PeerView } from "@/lib/types/PeerView";
import { useAction } from "@/lib/use-action";
import { usePoll } from "@/lib/use-poll";
import { channelCapacityError, hostPortError, nodeIdError, peerConnectionError, pushError } from "@/lib/validate";

const POLL_MS = 5000;
const LABELS_POLL_MS = 30000;

export function Channels(): ReactElement {
  const peers = usePoll(getPeers, POLL_MS);
  const channels = usePoll(getChannels, POLL_MS);
  const balances = usePoll(getBalances, POLL_MS);
  const labels = usePoll(getNodeLabels, LABELS_POLL_MS).data ?? {};
  const error = peers.error ?? channels.error;

  const refresh = (): void => {
    peers.refresh();
    channels.refresh();
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Channels" description="Connect to peers, open channels and see where your liquidity sits." />
      {error !== null && <ApiErrorNotice error={error} />}
      <div className="grid gap-6 lg:grid-cols-2">
        <PeerCard peers={peers.data ?? []} labels={labels} onChange={refresh} />
        <OpenChannelCard
          onOpened={refresh}
          spendableSat={balances.data?.onchain_spendable_sat ?? null}
          peers={peers.data ?? []}
        />
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Your channels</CardTitle>
          <CardDescription>
            A channel is a 2-of-2 on-chain output. Paying moves its balance from your side to theirs.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {channels.data !== null && channels.data.length === 0 && (
            <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed px-4 py-10 text-center">
              <WaypointsIcon className="size-8 text-muted-foreground" aria-hidden />
              <p className="font-medium">No channels yet.</p>
              <p className="text-sm text-muted-foreground">Connect to a peer, then open a channel with it.</p>
            </div>
          )}
          {sortChannels(channels.data ?? []).map((channel: ChannelView) => (
            <ChannelRow key={channel.user_channel_id} channel={channel} labels={labels} onClosed={refresh} />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

// === Peers

/** The name of a node this setup runs, such as "Peer node". Nothing for any other node. */
function NodeName({ labels, nodeId }: { labels: Record<string, string>; nodeId: string }): ReactElement | null {
  const label = labels[nodeId];
  return label === undefined ? null : (
    <Badge variant="outline" data-testid="node-name">
      {label}
    </Badge>
  );
}

function PeerCard({
  peers,
  labels,
  onChange,
}: {
  peers: PeerView[];
  labels: Record<string, string>;
  onChange: () => void;
}): ReactElement {
  const [nodeId, setNodeId] = useState<string>("");
  const [address, setAddress] = useState<string>("");
  const action = useAction();
  const idError = nodeIdError(nodeId);
  const addrError = hostPortError(address);

  async function onSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const ok = await action.run((): Promise<void> => connectPeer(nodeId.trim(), address.trim()));
    if (ok) {
      setNodeId("");
      setAddress("");
      onChange();
    }
  }

  async function onDisconnect(peerId: string): Promise<void> {
    if (await action.run((): Promise<void> => disconnectPeer(peerId))) {
      onChange();
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Peers</CardTitle>
        <CardDescription>Nodes you have a network connection to. A channel needs one first.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <ul className="flex flex-col gap-2 text-sm">
          {peers.length === 0 && <li className="rounded-lg border border-dashed px-3 py-4 text-center text-muted-foreground">Not connected to anyone.</li>}
          {peers.map((peer: PeerView) => (
            <li key={peer.node_id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 rounded-lg border px-3 py-2.5">
              <div className="flex min-w-0 flex-1 basis-64 flex-col gap-1.5">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <Badge variant={peer.is_connected ? "default" : "secondary"}>
                    {peer.is_connected ? "Online" : "Offline"}
                  </Badge>
                  <span className="inline-flex items-center gap-1 whitespace-nowrap">
                    <span className="font-mono" title={peer.node_id}>
                      {shortHex(peer.node_id)}
                    </span>
                    <CopyButton value={peer.node_id} label="node id" />
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                  <NodeName labels={labels} nodeId={peer.node_id} />
                  <span
                    className="font-mono"
                    title="The address this connection uses. For a peer that connected to you it is a temporary port, not the node's own listening address."
                  >
                    {peer.address}
                  </span>
                </div>
              </div>
              <Button
                variant="outline"
                size="xs"
                className="shrink-0"
                disabled={action.busy}
                aria-label={`Disconnect ${shortHex(peer.node_id)}`}
                onClick={(): void => void onDisconnect(peer.node_id)}
              >
                Disconnect
              </Button>
            </li>
          ))}
        </ul>
        <form className="flex flex-col gap-3" onSubmit={(e): void => void onSubmit(e)}>
          <div className="flex flex-col gap-2">
            <Label htmlFor="peer-id">Node id</Label>
            <Input
              id="peer-id"
              value={nodeId}
              aria-invalid={idError !== null}
              onChange={(e): void => setNodeId(e.target.value)}
              className="font-mono"
            />
            <FieldError message={idError} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="peer-address">Address</Label>
            <Input
              id="peer-address"
              value={address}
              aria-invalid={addrError !== null}
              onChange={(e): void => setAddress(e.target.value)}
              placeholder="127.0.0.1:9736"
              className="font-mono"
            />
            <FieldError message={addrError} />
          </div>
          {action.error !== null && <ApiErrorNotice error={action.error} />}
          <div>
            <Button
              type="submit"
              disabled={action.busy || nodeId.trim() === "" || address.trim() === "" || idError !== null || addrError !== null}
            >
              Connect
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

// === Open

function OpenChannelCard({
  onOpened,
  spendableSat,
  peers,
}: {
  onOpened: () => void;
  spendableSat: string | null;
  peers: PeerView[];
}): ReactElement {
  const [nodeId, setNodeId] = useState<string>("");
  const [address, setAddress] = useState<string>("");
  const [amountSat, setAmountSat] = useState<string>("1000000");
  const [pushSat, setPushSat] = useState<string>("");
  const action = useAction();

  const idError = nodeIdError(nodeId);
  const connectionError = peerConnectionError(nodeId, peers);
  const addrError = hostPortError(address);
  const amountError = channelCapacityError(amountSat, spendableSat);
  const pushErr = pushError(pushSat, amountSat);
  const amountOk = amountSat.trim() !== "" && amountError === null;
  const pushOk = pushErr === null;

  async function onSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const push = pushSat.trim() === "" ? "" : (BigInt(pushSat.trim()) * BigInt(1000)).toString();
    const ok = await action.run(async (): Promise<void> => {
      await openChannel({ nodeId: nodeId.trim(), address: address.trim(), amountSat: amountSat.trim(), pushMsat: push });
    });
    if (ok) {
      onOpened();
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Open a channel</CardTitle>
        <CardDescription>
          Locks on-chain funds into a channel. On regtest it confirms by itself in a few seconds while <code className="font-mono">npm run dev</code> runs automine; otherwise run <code className="font-mono">backend/scripts/regtest.sh mine 6</code>.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="flex flex-col gap-3" onSubmit={(e): void => void onSubmit(e)}>
          <div className="flex flex-col gap-2">
            <Label htmlFor="open-id">Peer node id</Label>
            <Input
              id="open-id"
              value={nodeId}
              aria-invalid={idError !== null || connectionError !== null}
              onChange={(e): void => setNodeId(e.target.value)}
              className="font-mono"
            />
            <FieldError message={idError ?? connectionError} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="open-address">Peer address</Label>
            <Input
              id="open-address"
              value={address}
              aria-invalid={addrError !== null}
              onChange={(e): void => setAddress(e.target.value)}
              placeholder="127.0.0.1:9736"
              className="font-mono"
            />
            <FieldError message={addrError} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="open-amount">Capacity (sat)</Label>
              <Input
                id="open-amount"
                inputMode="numeric"
                value={amountSat}
                aria-invalid={amountError !== null}
                onChange={(e): void => setAmountSat(e.target.value)}
              />
              <FieldError message={amountError} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="open-push">
                <InfoTip
                  label="Push to peer (sat)"
                  explanation="Gives the peer part of the channel balance at open, so they can pay you right away. It is a gift: you do not get it back."
                />
              </Label>
              <Input
                id="open-push"
                inputMode="numeric"
                value={pushSat}
                aria-invalid={pushErr !== null}
                placeholder="0"
                onChange={(e): void => setPushSat(e.target.value)}
              />
              <FieldError message={pushErr} />
            </div>
          </div>
          {action.error !== null && <ApiErrorNotice error={action.error} />}
          <div>
            <Button
              type="submit"
              disabled={
                action.busy ||
                !amountOk ||
                !pushOk ||
                nodeId.trim() === "" ||
                address.trim() === "" ||
                idError !== null ||
                connectionError !== null ||
                addrError !== null
              }
            >
              Open channel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

// === Channel row

/**
 * Oldest channel first, newest last. The node returns channels in no fixed order, so without this a
 * new channel could shuffle the rows and put a different channel under a "Completed" badge.
 * Confirmations only grow, so the order of older channels never changes; unconfirmed ones go last.
 */
export function sortChannels(channels: ChannelView[]): ChannelView[] {
  return [...channels].sort((a: ChannelView, b: ChannelView): number => {
    const byAge = (b.confirmations ?? -1) - (a.confirmations ?? -1);
    return byAge !== 0 ? byAge : a.channel_id.localeCompare(b.channel_id);
  });
}

/** True once the whole amount has moved to the other side: nothing spendable is left to send (or to receive). */
export function isChannelCompleted(channel: ChannelView): boolean {
  if (!channel.is_channel_ready) {
    return false;
  }
  const left = leftToMove(channel);
  return (channel.is_outbound ? left.send : left.receive) === BigInt(0);
}

export function channelState(channel: ChannelView): string {
  if (isChannelCompleted(channel)) {
    return "Completed";
  }
  if (channel.is_usable) {
    return "Still open";
  }
  if (channel.is_channel_ready) {
    return "Peer offline";
  }
  if (channel.confirmations_required !== null) {
    return `Confirming ${channel.confirmations ?? 0}/${channel.confirmations_required}`;
  }
  return "Pending";
}

type Confirm = "none" | "close" | "force";

export function ChannelRow({
  channel,
  labels = {},
  onClosed,
}: {
  channel: ChannelView;
  labels?: Record<string, string>;
  onClosed: () => void;
}): ReactElement {
  const [confirm, setConfirm] = useState<Confirm>("none");
  const action = useAction();

  async function close(force: boolean): Promise<void> {
    const ok = await action.run((): Promise<void> => closeChannel(channel, force));
    if (ok) {
      setConfirm("none");
      onClosed();
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border p-3" data-testid="channel">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Badge variant={channel.is_usable ? "default" : "secondary"}>{channelState(channel)}</Badge>
        <span>{formatSat(channel.capacity_sat)}</span>
        <span className="text-muted-foreground">with</span>
        <span className="font-mono" title={channel.counterparty_node_id}>
          {shortHex(channel.counterparty_node_id)}
        </span>
        <CopyButton value={channel.counterparty_node_id} label="node id" />
        <NodeName labels={labels} nodeId={channel.counterparty_node_id} />
        <span className="text-muted-foreground">{channel.is_outbound ? "(you opened it)" : "(they opened it)"}</span>
      </div>
      <ChannelAllowance channel={channel} />
      <dl className="grid grid-cols-1 gap-x-4 gap-y-1 text-xs sm:grid-cols-[auto_1fr]">
        <dt className="text-muted-foreground">Channel id</dt>
        <dd className="flex items-start gap-1">
          <span className="break-all font-mono" title={channel.channel_id}>
            {shortHex(channel.channel_id)}
          </span>
          <CopyButton value={channel.channel_id} label="channel id" />
        </dd>
        <dt className="text-muted-foreground">Short channel id</dt>
        <dd className="font-mono">{channel.short_channel_id ?? "not confirmed yet"}</dd>
        <dt className="text-muted-foreground">
          <InfoTip
            label="Largest single payment"
            explanation="The most one payment can carry over this channel right now. It is always below the channel amount, and never more than the balance on your side."
          />
        </dt>
        <dd>{formatMsat(channel.max_send_msat)}</dd>
        <dt className="text-muted-foreground">
          <InfoTip
            label="Your balance"
            explanation="Everything on your side of the channel: what you would claim if it closed now. It includes your reserve, so it is more than Can send. If you opened the channel it can be a little lower than Can send plus your reserve, because the opener pays the closing fee and anchor outputs."
          />
        </dt>
        <dd className="font-mono" data-testid="our-balance">
          {channel.our_balance_sat === null ? "not confirmed yet" : formatSat(channel.our_balance_sat)}
        </dd>
        <dt className="text-muted-foreground">
          <InfoTip
            label="Reserve"
            explanation="Each side must keep a small reserve in the channel so nobody can cheat by closing with an old state. It is part of the balance but cannot be spent, so it is not counted in Can send or Can receive. The first sats a peer receives go toward filling theirs, which is why a first small payment can leave their Can send at 0."
          />
        </dt>
        <dd data-testid="reserve">
          You keep <span className="font-mono">{channel.our_reserve_sat === null ? "?" : formatSat(channel.our_reserve_sat)}</span>
          {", "}they keep <span className="font-mono">{formatSat(channel.their_reserve_sat)}</span>
        </dd>
        <dt className="text-muted-foreground">Funding output</dt>
        <dd className="flex items-start gap-1">
          <span className="break-all font-mono">{channel.funding_txo ?? "not broadcast yet"}</span>
          {channel.funding_txo !== null && <CopyButton value={channel.funding_txo} label="funding output" />}
        </dd>
      </dl>
      {action.error !== null && <ApiErrorNotice error={action.error} />}
      {confirm === "none" && (
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={(): void => setConfirm("close")}>
            Close
          </Button>
          <Button variant="destructive" size="sm" onClick={(): void => setConfirm("force")}>
            Force close
          </Button>
        </div>
      )}
      {confirm !== "none" && (
        <div role="alertdialog" aria-label="Confirm close" className="flex flex-col gap-2 rounded-md bg-muted p-3 text-sm">
          <p>
            {confirm === "close"
              ? "Close cooperatively? Both sides sign a closing transaction and the funds return on-chain after it confirms."
              : "Force close? Your latest state goes on-chain without the peer. Your funds stay locked for the dispute period and fees are higher."}
          </p>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant={confirm === "force" ? "destructive" : "default"}
              disabled={action.busy}
              onClick={(): void => void close(confirm === "force")}
            >
              {confirm === "force" ? "Yes, force close" : "Yes, close"}
            </Button>
            <Button size="sm" variant="ghost" onClick={(): void => setConfirm("none")}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
