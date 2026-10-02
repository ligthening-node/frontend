import type { Metadata } from "next";
import { IBM_Plex_Sans, JetBrains_Mono } from "next/font/google";
import type { ReactElement } from "react";

import { LiveEvents } from "@/components/node/live-events";
import { MarketVideo } from "@/components/shell/market-video";
import { NetworkBackground } from "@/components/shell/network-background";
import { SiteHeader } from "@/components/shell/site-header";
import { THEME_INIT_SCRIPT } from "@/components/shell/theme-toggle";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ErrorToastProvider } from "@/lib/error-toasts";
import { NodeEventsProvider } from "@/lib/node-events";
import { nodeRole } from "@/lib/node-role";
import "./globals.css";

const plexSans = IBM_Plex_Sans({
  variable: "--font-plex-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Lightning Tool",
    template: "%s | Lightning Tool",
  },
  description: "Learn how Lightning payments work, starting with what is inside a BOLT11 invoice.",
};

export default function RootLayout({ children }: LayoutProps<"/">): ReactElement {
  const role = nodeRole({
    NODE_LABEL: process.env.NODE_LABEL,
    LN_API_URL: process.env.LN_API_URL,
    LN_API_TOKEN: process.env.LN_API_TOKEN,
  });
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${plexSans.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="flex min-h-full flex-col bg-background text-foreground">
        <MarketVideo />
        <NetworkBackground />
        <NodeEventsProvider>
          <ErrorToastProvider>
            <TooltipProvider>
              <SiteHeader role={role} />
              <main id="main" className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 py-8">
                {children}
              </main>
              <LiveEvents />
            </TooltipProvider>
          </ErrorToastProvider>
        </NodeEventsProvider>
      </body>
    </html>
  );
}
