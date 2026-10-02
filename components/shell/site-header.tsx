"use client";

import { MenuIcon, XIcon, ZapIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import type { ReactElement } from "react";

import { ThemeToggle } from "@/components/shell/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getNodeStatus } from "@/lib/api";
import type { NodeRole } from "@/lib/node-role";
import { usePoll } from "@/lib/use-poll";

const NAV_LINKS: { href: string; label: string }[] = [
  { href: "/", label: "Dashboard" },
  { href: "/wallet", label: "Wallet" },
  { href: "/channels", label: "Channels" },
  { href: "/receive", label: "Receive" },
  { href: "/send", label: "Send" },
  { href: "/payments", label: "Payments" },
  { href: "/decode", label: "Decoder" },
];

const STATUS_POLL_MS = 10000;

function isActive(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

/** A dot and a few words, so the node's state is visible from every page and not by colour alone. */
function NodeStatusChip(): ReactElement {
  const status = usePoll(getNodeStatus, STATUS_POLL_MS);
  const node = status.data;
  const offline = node === null && status.error !== null;
  const synced = node !== null && node.is_running && node.is_synced;
  const text = offline ? "Offline" : node === null ? "Connecting" : synced ? "Synced" : "Syncing";
  const dot = offline ? "bg-destructive" : synced ? "bg-success" : "bg-warning";
  return (
    <span
      data-testid="node-status"
      className="hidden items-center gap-2 rounded-full border bg-card px-2.5 py-1 text-xs text-muted-foreground sm:inline-flex"
    >
      <span aria-hidden className={`size-2 rounded-full ${dot}`} />
      <span className="text-foreground">{text}</span>
      {node !== null && <span className="font-mono">#{node.block_height}</span>}
    </span>
  );
}

export function SiteHeader({ role }: { role: NodeRole | null }): ReactElement {
  const pathname = usePathname();
  const [open, setOpen] = useState<boolean>(false);

  return (
    <header className={`sticky top-0 z-40 bg-background/95 backdrop-blur ${role?.isPeer === true ? "border-b-2 border-primary" : "border-b"}`}>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-primary-foreground"
      >
        Skip to content
      </a>
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4">
        <Link href="/" className="flex items-center gap-2 font-semibold" onClick={(): void => setOpen(false)}>
          <span aria-hidden className="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <ZapIcon className="size-4" />
          </span>
          <span className="hidden sm:inline">Lightning Tool</span>
        </Link>
        {role !== null && (
          <Badge
            data-testid="node-role"
            variant={role.isPeer ? "secondary" : "default"}
            className={role.isPeer ? "bg-primary/15 text-accent-foreground" : undefined}
          >
            {role.label}
          </Badge>
        )}
        <nav aria-label="Main" className="ml-4 hidden items-center gap-1 md:flex">
          {NAV_LINKS.map((link) => {
            const active = isActive(pathname, link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={`rounded-md px-2.5 py-1.5 text-sm transition-colors duration-150 ease-out-strong ${
                  active ? "bg-primary/15 font-medium text-accent-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          {role !== null && <NodeStatusChip />}
          <ThemeToggle />
          <Button
            variant="ghost"
            size="icon"
            className="size-10 md:hidden"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            aria-controls="mobile-nav"
            onClick={(): void => setOpen((value: boolean): boolean => !value)}
          >
            {open ? <XIcon /> : <MenuIcon />}
          </Button>
        </div>
      </div>
      {open && (
        <nav id="mobile-nav" aria-label="Mobile" className="border-t md:hidden">
          <ul className="mx-auto flex max-w-6xl flex-col px-2 py-2">
            {NAV_LINKS.map((link) => {
              const active = isActive(pathname, link.href);
              return (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    aria-current={active ? "page" : undefined}
                    onClick={(): void => setOpen(false)}
                    className={`flex min-h-11 items-center rounded-md px-3 text-sm ${
                      active ? "bg-primary/15 font-medium text-accent-foreground" : "text-foreground hover:bg-muted"
                    }`}
                  >
                    {link.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      )}
    </header>
  );
}
