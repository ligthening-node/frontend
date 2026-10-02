import { CircleAlertIcon, CircleCheckIcon, CircleXIcon } from "lucide-react";
import type { ReactElement } from "react";

import { amountParts, formatDuration, formatUnixUtc, networkName } from "@/lib/format";
import type { Decoded } from "@/lib/types/Decoded";
import type { Verdict } from "@/lib/types/Verdict";

const VERDICT_STYLE: Record<Verdict, { title: string; hint: string; className: string; icon: ReactElement }> = {
  payable: {
    title: "Payable",
    hint: "Well-formed, correctly signed and passes every check you asked for.",
    className: "border-emerald-500/40 bg-emerald-500/10 text-emerald-900 dark:text-emerald-100",
    icon: <CircleCheckIcon className="size-6 shrink-0" />,
  },
  not_payable: {
    title: "Not payable",
    hint: "The invoice is genuine, but it is expired, for another network, or fails one of your checks.",
    className: "border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-100",
    icon: <CircleAlertIcon className="size-6 shrink-0" />,
  },
  invalid: {
    title: "Invalid",
    hint: "The signature is wrong or a required field is missing. Do not pay this.",
    className: "border-red-500/40 bg-red-500/10 text-red-900 dark:text-red-100",
    icon: <CircleXIcon className="size-6 shrink-0" />,
  },
};

export function VerdictBanner({ decoded, evaluatedAt }: { decoded: Decoded; evaluatedAt: number }): ReactElement {
  const { invoice, report } = decoded;
  const style = VERDICT_STYLE[report.verdict];

  const amount = invoice.amount_msat === null ? "Any amount" : `${amountParts(invoice.amount_msat).sat} sat`;
  const remaining = invoice.expires_at - evaluatedAt;
  const expiry = remaining > 0 ? `expires in ${formatDuration(remaining)}` : `expired ${formatDuration(-remaining)} ago`;

  return (
    <section
      aria-label="Verdict"
      className={`flex items-start gap-3 rounded-xl border px-4 py-3 ${style.className}`}
    >
      {style.icon}
      <div className="flex flex-col gap-1">
        <p className="text-lg font-semibold">{style.title}</p>
        <p className="text-sm">
          {amount} on {networkName(invoice.network)}, {expiry} (checked at {formatUnixUtc(evaluatedAt)}).
        </p>
        <p className="text-sm opacity-80">{style.hint}</p>
      </div>
    </section>
  );
}
