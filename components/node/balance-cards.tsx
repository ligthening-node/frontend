import { BitcoinIcon, LockIcon, WalletIcon, ZapIcon } from "lucide-react";
import type { ReactElement, ReactNode } from "react";

import { Card, CardContent } from "@/components/ui/card";
import { formatBtc, formatSat } from "@/lib/format";
import type { Balances } from "@/lib/types/Balances";

/** Everything the node holds that can be spent: its on-chain coins plus what sits in channels. */
export function totalSat(balances: Balances): string {
  return (BigInt(balances.onchain_total_sat) + BigInt(balances.lightning_sat)).toString();
}

function Stat({ icon, label, hint, value }: { icon: ReactNode; label: string; hint: string; value: string }): ReactElement {
  return (
    <Card size="sm">
      <CardContent className="flex items-start gap-3">
        <span aria-hidden className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-primary">
          {icon}
        </span>
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="font-mono text-lg font-medium break-words">{formatSat(value)}</p>
          <p className="text-xs text-muted-foreground">{hint}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export function BalanceCards({ balances }: { balances: Balances }): ReactElement {
  const total = totalSat(balances);
  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardContent className="flex flex-col gap-1">
          <p className="text-sm text-muted-foreground">Total balance</p>
          <p data-testid="total-balance" className="font-mono text-3xl font-semibold break-words sm:text-4xl">
            {formatSat(total)}
          </p>
          <p className="font-mono text-sm text-muted-foreground">{formatBtc(total)}</p>
        </CardContent>
      </Card>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon={<BitcoinIcon className="size-4" />} label="On-chain total" hint="Coins in the wallet" value={balances.onchain_total_sat} />
        <Stat icon={<WalletIcon className="size-4" />} label="On-chain spendable" hint="Ready to send now" value={balances.onchain_spendable_sat} />
        <Stat icon={<ZapIcon className="size-4" />} label="Lightning" hint="Your side of open channels" value={balances.lightning_sat} />
        <Stat icon={<LockIcon className="size-4" />} label="Anchor reserve" hint="Kept back to close channels" value={balances.anchor_reserve_sat} />
      </div>
    </div>
  );
}
