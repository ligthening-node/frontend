"use client";

import { ArrowDownToLineIcon, RefreshCwIcon, SendHorizontalIcon, WaypointsIcon } from "lucide-react";
import { cn } from "cn";
import Link from "next/link";
import type { ReactElement } from "react";

import { BalanceCards } from "@/components/node/balance-cards";
import { ApiErrorNotice } from "@/components/node/unreachable";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CopyButton } from "@/components/ui/copy-button";
import { getBalances, getNodeStatus, syncNode } from "@/lib/api";
import { formatUnixUtc } from "@/lib/format";
import { useAction } from "@/lib/use-action";
import { usePoll } from "@/lib/use-poll";

const POLL_MS = 5000;

const QUICK_ACTIONS: { href: string; label: string; icon: ReactElement }[] = [
  { href: "/receive", label: "Receive", icon: <ArrowDownToLineIcon /> },
  { href: "/send", label: "Send", icon: <SendHorizontalIcon /> },
  { href: "/channels", label: "Open a channel", icon: <WaypointsIcon /> },
];

export function Dashboard(): ReactElement {
  const status = usePoll(getNodeStatus, POLL_MS);
  const balances = usePoll(getBalances, POLL_MS);
  const sync = useAction();
  const error = status.error ?? balances.error ?? sync.error;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Your node, its balances and what you can do next.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {QUICK_ACTIONS.map((action) => (
            <Link key={action.href} href={action.href} className={cn(buttonVariants({ variant: "outline" }), "h-10 px-3 md:h-8")}>
              {action.icon}
              {action.label}
            </Link>
          ))}
        </div>
      </div>
      {error !== null && <ApiErrorNotice error={error} />}
      {balances.data !== null && <BalanceCards balances={balances.data} />}
      {status.data !== null && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Node
              <Badge variant={status.data.is_synced ? "default" : "secondary"}>
                {status.data.is_running ? (status.data.is_synced ? "Synced" : "Syncing") : "Stopped"}
              </Badge>
              <Button
                variant="outline"
                size="sm"
                className="ml-auto h-10 md:h-7"
                disabled={sync.busy}
                onClick={(): void => void sync.run(async (): Promise<void> => {
                  await syncNode();
                  status.refresh();
                  balances.refresh();
                })}
              >
                <RefreshCwIcon className={sync.busy ? "animate-spin" : undefined} />
                {sync.busy ? "Syncing..." : "Sync now"}
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-[auto_1fr]">
              <dt className="text-muted-foreground">Network</dt>
              <dd>{status.data.network}</dd>
              <dt className="text-muted-foreground">Block height</dt>
              <dd className="font-mono">{status.data.block_height}</dd>
              <dt className="text-muted-foreground">Last chain sync</dt>
              <dd>{status.data.last_onchain_sync === null ? "never" : formatUnixUtc(status.data.last_onchain_sync)}</dd>
              <dt className="text-muted-foreground">Node id</dt>
              <dd className="flex items-start gap-1">
                <span className="break-all font-mono">{status.data.node_id}</span>
                <CopyButton value={status.data.node_id} label="node id" />
              </dd>
              <dt className="text-muted-foreground">Listening on</dt>
              <dd className="flex items-start gap-1">
                <span className="font-mono">{status.data.listening_addresses.join(", ") || "nowhere"}</span>
                {status.data.listening_addresses.length > 0 && (
                  <CopyButton value={status.data.listening_addresses.join(", ")} label="listening address" />
                )}
              </dd>
            </dl>
          </CardContent>
        </Card>
      )}
      {status.loading && balances.loading && <p className="text-sm text-muted-foreground">Loading...</p>}
    </div>
  );
}
