import { ArrowRight, Zap } from "lucide-react";
import Link from "next/link";
import type { ReactElement } from "react";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function ChannelRequiredNotice({ message }: { message: string }): ReactElement {
  return (
    <div
      role="alert"
      className="flex flex-col gap-4 rounded-xl border border-primary/30 bg-primary/5 p-4 sm:flex-row sm:items-center sm:gap-5 sm:p-5"
    >
      <div
        aria-hidden="true"
        className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary/15 text-accent-foreground"
      >
        <Zap className="size-5" />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="font-semibold">Create a channel first</p>
        <p className="text-sm text-muted-foreground">{message}</p>
      </div>
      <Link href="/channels" className={cn(buttonVariants(), "w-full shrink-0 sm:w-auto")}>
        Go to Channels
        <ArrowRight aria-hidden="true" className="size-4" />
      </Link>
    </div>
  );
}
